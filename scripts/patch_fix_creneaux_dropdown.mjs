import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".angular" || e.name === "dist") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function backup(file) {
  const stamp = process.env.STAMP || "backup";
  const b = `${file}.bak.${stamp}`;
  if (!fs.existsSync(b)) fs.copyFileSync(file, b);
  return b;
}

function ensureImport(src, fromModule, named) {
  // Ensure: import { a, b } from 'module';
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${fromModule}['"];?`);
  const m = src.match(re);
  if (m) {
    const existing = m[1].split(",").map(s => s.trim()).filter(Boolean);
    const want = Array.from(new Set([...existing, ...named])).sort();
    return src.replace(re, `import { ${want.join(", ")} } from '${fromModule}';`);
  }
  // Insert after first import line
  const firstImport = src.match(/^\s*import .*?;\s*$/m);
  if (firstImport) {
    const idx = src.indexOf(firstImport[0]) + firstImport[0].length;
    return src.slice(0, idx) + `\nimport { ${named.join(", ")} } from '${fromModule}';` + src.slice(idx);
  }
  // No imports found: prepend
  return `import { ${named.join(", ")} } from '${fromModule}';\n` + src;
}

function ensureDefaultImport(src, ident, fromModule) {
  const re = new RegExp(`import\\s+${ident}\\s+from\\s+['"]${fromModule}['"];?`);
  if (re.test(src)) return src;
  const firstImport = src.match(/^\s*import .*?;\s*$/m);
  if (firstImport) {
    const idx = src.indexOf(firstImport[0]) + firstImport[0].length;
    return src.slice(0, idx) + `\nimport ${ident} from '${fromModule}';` + src.slice(idx);
  }
  return `import ${ident} from '${fromModule}';\n` + src;
}

function ensureSideImport(src, fromModule) {
  const re = new RegExp(`import\\s+['"]${fromModule}['"];?`);
  if (re.test(src)) return src;
  const firstImport = src.match(/^\s*import .*?;\s*$/m);
  if (firstImport) {
    const idx = src.indexOf(firstImport[0]) + firstImport[0].length;
    return src.slice(0, idx) + `\nimport '${fromModule}';` + src.slice(idx);
  }
  return `import '${fromModule}';\n` + src;
}

function hasMarker(src, marker) {
  return src.includes(marker);
}

function injectLogicIntoClass(ts) {
  // Adds a robust block inside the component class if not present.
  // Marker: creneaux-dropdown-fix-v1
  if (hasMarker(ts, "creneaux-dropdown-fix-v1")) return ts;

  const classRe = /export\s+class\s+\w+\s*\{/;
  const m = ts.match(classRe);
  if (!m) return ts;

  const insertAt = ts.indexOf(m[0]) + m[0].length;

  const block = `
  // --- creneaux-dropdown-fix-v1 ---
  private readonly configService = inject(ConfigService);

  /** Retourne le FormGroup même si le composant utilise un nom différent (form/reservationForm/formGroup) */
  private _fg(): any {
    return (this as any).form || (this as any).reservationForm || (this as any).formGroup;
  }

  /** Créneaux disponibles selon la date sélectionnée (filtre validFrom/validTo si présents) */
  readonly availableSlots = computed(() => {
    const fg = this._fg();
    const date = fg?.get?.('date')?.value as string | null | undefined;
    const slots = (this.configService.settings?.() as any)?.creneaux ?? (this.configService.settings as any)?.creneaux ?? [];
    if (!date) return slots;

    return (Array.isArray(slots) ? slots : []).filter((s: any) => {
      const vf = s?.validFrom;
      const vt = s?.validTo;
      const okFrom = !vf || date >= vf;
      const okTo = !vt || date <= vt;
      return okFrom && okTo;
    });
  });
  // --- /creneaux-dropdown-fix-v1 ---

`;
  return ts.slice(0, insertAt) + block + ts.slice(insertAt);
}

function patchInlineTemplate(ts) {
  // Replace options inside select under label "Créneau Disponible" OR select with formControlName slotId/selectedSlotId
  // Works even if label is different, by targeting the first select bound to slotId/selectedSlotId.
  const selectRe = /(<select[^>]*formControlName\s*=\s*"(?:selectedSlotId|slotId)"[^>]*>)([\s\S]*?)(<\/select>)/m;
  const mm = ts.match(selectRe);
  if (!mm) return { changed: false, ts };

  const replacementInner = `
      <option value="">-- Sélectionner --</option>
      <option *ngFor="let s of availableSlots()" [value]="s.id">
        {{ s.label }} ({{ s.start }}-{{ s.end }}) - {{ s.price }} DT
      </option>
  `.trim();

  const ts2 = ts.replace(selectRe, `$1\n${replacementInner}\n$3`);
  return { changed: ts2 !== ts, ts: ts2 };
}

function patchHtmlTemplate(html) {
  const selectRe = /(<select[^>]*formControlName\s*=\s*"(?:selectedSlotId|slotId)"[^>]*>)([\s\S]*?)(<\/select>)/m;
  const mm = html.match(selectRe);
  if (!mm) return { changed: false, html };

  const replacementInner = `
  <option value="">-- Sélectionner --</option>
  <option *ngFor="let s of availableSlots()" [value]="s.id">
    {{ s.label }} ({{ s.start }}-{{ s.end }}) - {{ s.price }} DT
  </option>
  `.trim();

  const html2 = html.replace(selectRe, `$1\n${replacementInner}\n$3`);
  return { changed: html2 !== html, html: html2 };
}

function patchReservationTS(file) {
  let ts = fs.readFileSync(file, "utf-8");
  const before = ts;

  // Ensure imports
  ts = ensureImport(ts, "@angular/core", ["computed", "inject"]);
  ts = ensureImport(ts, "src/app/core/services/config.service", ["ConfigService"])
    // fallback if project uses relative imports
    .replace(/from\s+'src\/app\/core\/services\/config\.service'/g, "from '../../core/services/config.service'"); // harmless if not matching
  // Also try a second common path (without rewriting if already ok)
  if (!ts.includes("ConfigService")) {
    // try common relative paths:
    ts = ensureImport(ts, "../../core/services/config.service", ["ConfigService"]);
    ts = ensureImport(ts, "../../../core/services/config.service", ["ConfigService"]);
    ts = ensureImport(ts, "../../../../core/services/config.service", ["ConfigService"]);
  }

  // Inject computed logic
  ts = injectLogicIntoClass(ts);

  // Patch inline template if exists
  const { changed, ts: ts2 } = patchInlineTemplate(ts);
  ts = ts2;

  if (ts !== before) {
    backup(file);
    fs.writeFileSync(file, ts, "utf-8");
    return { file, changed: true, inlineSelectPatched: changed };
  }
  return { file, changed: false, inlineSelectPatched: false };
}

function findTemplateUrl(ts) {
  // templateUrl: './x.component.html'
  const m = ts.match(/templateUrl\s*:\s*['"](.+?)['"]/);
  return m?.[1];
}

function run() {
  const root = process.cwd();
  const all = walk(root);

  // Candidates: any reservation-form component under features (calendar OR reservations)
  const tsFiles = all.filter(p =>
    p.endsWith(".component.ts") &&
    p.includes(path.join("src", "app", "features")) &&
    p.toLowerCase().includes("reservation") &&
    p.toLowerCase().includes("form")
  );

  if (!tsFiles.length) {
    console.error("❌ Aucun fichier Reservation Form trouvé (features/**/reservation*form*.component.ts).");
    process.exit(1);
  }

  const results = [];

  for (const f of tsFiles) {
    const r = patchReservationTS(f);
    results.push(r);

    // If it uses templateUrl, patch HTML too
    const ts = fs.readFileSync(f, "utf-8");
    const tpl = findTemplateUrl(ts);
    if (tpl) {
      const htmlPath = path.resolve(path.dirname(f), tpl);
      if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, "utf-8");
        const before = html;
        const pr = patchHtmlTemplate(html);
        if (pr.changed) {
          backup(htmlPath);
          fs.writeFileSync(htmlPath, pr.html, "utf-8");
          results.push({ file: htmlPath, changed: true, inlineSelectPatched: false });
        }
      }
    }
  }

  // Report
  const touched = results.filter(r => r.changed);
  console.log("✅ Patch terminé.");
  console.log(`📌 Fichiers trouvés : ${tsFiles.length}`);
  console.log(`🧩 Fichiers modifiés : ${touched.length}`);

  for (const r of touched) {
    console.log(`  - ${r.file}`);
  }

  // Safety note: if ConfigService import path is wrong, developer can adjust manually.
  console.log("\nℹ️ Si ton projet n'utilise pas les imports 'src/...', le script a aussi tenté des imports relatifs.");
  console.log("ℹ️ Lance maintenant: ng serve");
}

run();
