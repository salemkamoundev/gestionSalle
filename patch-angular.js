const fs = require('fs');

function patchFile(path, patchFn) {
  if (!fs.existsSync(path)) {
    console.log(`⚠️  [SKIP] introuvable: ${path}`);
    return;
  }
  const before = fs.readFileSync(path, 'utf8');
  const after = patchFn(before);
  if (after === before) {
    console.log(`ℹ️  [NOCHANGE] ${path}`);
    return;
  }
  fs.writeFileSync(path, after, 'utf8');
  console.log(`✅ [PATCHED] ${path}`);
}

function ensureApremInCalendarHtml(content) {
  // On cherche les commentaires (présents dans ton HTML) :
  // <!-- Slot Matin --> ... <!-- Slot Soir -->
  if (content.includes('Slot Après-midi') || content.includes('Slot Après-midi')) return content;

  const idxSoir = content.indexOf('<!-- Slot Soir -->');
  if (idxSoir === -1) return content;

  // Bloc "aprem" injecté avant "Slot Soir"
  const apremBlock = `
          <!-- Slot Après-midi -->
          <div class="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition"
               (click)="onSlotClick(date, 'aprem')">
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-semibold text-amber-800">Après-midi</h4>
              <span class="text-xs text-amber-600">13:00 - 17:00</span>
            </div>

            <div class="space-y-2">
              @for (res of getReservationsForSlot(date, 'aprem'); track res.id) {
                <div class="bg-white p-2 rounded border border-amber-200 shadow-sm">
                  <div class="flex justify-between items-center">
                    <span class="font-medium text-slate-800">{{ res.clientName || res.clientId || 'Client' }}</span>
                    <span class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{{ res.status }}</span>
                  </div>
                  <p class="text-xs text-slate-500 mt-1">{{ res.startTime || '13:00' }} - {{ res.endTime || '17:00' }}</p>
                </div>
              } @empty {
                <p class="text-sm text-amber-600 italic">Disponible</p>
              }
            </div>
          </div>

`;

  return content.slice(0, idxSoir) + apremBlock + content.slice(idxSoir);
}

function patchCalendarTs(content) {
  // Rend le filtrage slot robuste:
  // - accepte selectedSlotId (model récent)
  // - accepte slotId (ancien)
  // - accepte slotKey (si présent)
  // Et ne duplique plus partout les réservations sans slot.
  const re = /getReservationsForSlot\s*\(\s*date\s*:\s*string\s*,\s*slot\s*:\s*string\s*\)\s*:\s*any\[\]\s*\{[\s\S]*?\n\s*\}/m;
  if (!re.test(content)) return content;

  const replacement = `
  getReservationsForSlot(date: string, slot: string): any[] {
    const day = (this.reservationsByDate()[date] || []) as any[];
    return day.filter((r: any) => {
      const key = (r?.slotKey || r?.selectedSlotId || r?.slotId || '').toString();
      // compat: certains anciens slotId = "as_matin_2025" => on mappe vers "matin"
      const normalized =
        key.includes('matin') ? 'matin' :
        (key.includes('aprem') || key.includes('après') || key.includes('apres')) ? 'aprem' :
        key.includes('soir') ? 'soir' :
        key;

      return normalized === slot;
    });
  }`;

  return content.replace(re, replacement);
}

function patchReservationFormTs(content) {
  // Ajoute aprem dans availableSlots si absent
  if (content.includes("id: 'aprem'") || content.includes('Après-midi')) return content;

  // essaie de patcher le tableau availableSlots: [ {id:'matin'...}, {id:'soir'...} ]
  const re = /availableSlots\s*=\s*\[\s*([\s\S]*?)\s*\]\s*;/m;
  if (!re.test(content)) return content;

  return content.replace(re, (m, inner) => {
    // Si le slot "soir" existe, on injecte "aprem" juste avant.
    if (!inner.includes("id: 'soir'")) {
      // fallback: ajoute à la fin
      return `availableSlots = [\n${inner}\n  { id: 'aprem', label: 'Après-midi', start: '13:00', end: '17:00' }\n];`;
    }

    const injected = inner.replace(
      /\{\s*id:\s*'soir'[\s\S]*?\},?/m,
      (soirBlock) =>
        `  { id: 'aprem', label: 'Après-midi', start: '13:00', end: '17:00' },\n` + soirBlock
    );

    return `availableSlots = [\n${injected}\n];`;
  });
}

patchFile('src/app/features/calendar/calendar-view/calendar-view.component.html', ensureApremInCalendarHtml);
patchFile('src/app/features/calendar/calendar-view/calendar-view.component.ts', patchCalendarTs);
patchFile('src/app/features/calendar/reservation-form/reservation-form.component.ts', patchReservationFormTs);

console.log("✅ Patch Angular terminé.");
