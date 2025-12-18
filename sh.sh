#!/bin/bash

TS_FILE="src/app/features/calendar/reservation-form/reservation-form.component.ts"
HTML_FILE="src/app/features/calendar/reservation-form/reservation-form.component.html"

echo "🔍 Ajout des filtres de recherche pour Prestataires et Staff..."

# 1. Mise à jour du TypeScript (Ajout des signaux et des filtres computed)
# On insère les nouveaux signaux et computed après clientSearch
sed -i '' "s|clientSearch = signal('');|clientSearch = signal('');\n  teamSearch = signal('');\n  staffSearch = signal('');|g" "$TS_FILE" 2>/dev/null || \
sed -i "s|clientSearch = signal('');|clientSearch = signal('');\n  teamSearch = signal('');\n  staffSearch = signal('');|g" "$TS_FILE"

# Insertion des computed pour filtrer les teams et le staff
sed -i '' "/filteredClients = computed/i \\
  filteredTeams = computed(() => {\\
    const q = this.teamSearch().toLowerCase();\\
    return q ? this.teams().filter(t => t.nom.toLowerCase().includes(q)) : this.teams();\\
  });\\
\\
  filteredStaff = computed(() => {\\
    const q = this.staffSearch().toLowerCase();\\
    return q ? this.servers().filter(s => s.nom.toLowerCase().includes(q)) : this.servers();\\
  });\\
" "$TS_FILE" 2>/dev/null || \
sed -i "/filteredClients = computed/i   filteredTeams = computed(() => {\n    const q = this.teamSearch().toLowerCase();\n    return q ? this.teams().filter(t => t.nom.toLowerCase().includes(q)) : this.teams();\n  });\n\n  filteredStaff = computed(() => {\n    const q = this.staffSearch().toLowerCase();\n    return q ? this.servers().filter(s => s.nom.toLowerCase().includes(q)) : this.servers();\n  });" "$TS_FILE"

# 2. Mise à jour du HTML (Ajout des inputs de recherche)
# Filtre Prestataires
sed -i '' "s|@for (team of teams(); track team.id) {|@for (team of filteredTeams(); track team.id) {|g" "$HTML_FILE" 2>/dev/null || \
sed -i "s|@for (team of teams(); track team.id) {|@for (team of filteredTeams(); track team.id) {|g" "$HTML_FILE"

sed -i '' "/<label.*Prestataires sélectionnés/a \\
          <input type=\"text\" (input)=\"teamSearch.set(\$any(\$event.target).value)\" placeholder=\"Filtrer prestataires...\" class=\"w-full px-3 py-1.5 text-xs rounded-lg border border-slate-100 mb-2 outline-none focus:border-purple-300\">" "$HTML_FILE" 2>/dev/null || \
sed -i "/<label.*Prestataires sélectionnés/a           <input type=\"text\" (input)=\"teamSearch.set(\$any(\$event.target).value)\" placeholder=\"Filtrer prestataires...\" class=\"w-full px-3 py-1.5 text-xs rounded-lg border border-slate-100 mb-2 outline-none focus:border-purple-300\">" "$HTML_FILE"

# Filtre Staff
sed -i '' "s|@for (staff of servers(); track staff.id) {|@for (staff of filteredStaff(); track staff.id) {|g" "$HTML_FILE" 2>/dev/null || \
sed -i "s|@for (staff of servers(); track staff.id) {|@for (staff of filteredStaff(); track staff.id) {|g" "$HTML_FILE"

sed -i '' "/<label.*Personnel de Salle/a \\
          <input type=\"text\" (input)=\"staffSearch.set(\$any(\$event.target).value)\" placeholder=\"Filtrer staff...\" class=\"w-full px-3 py-1.5 text-xs rounded-lg border border-slate-100 mb-2 outline-none focus:border-emerald-300\">" "$HTML_FILE" 2>/dev/null || \
sed -i "/<label.*Personnel de Salle/a           <input type=\"text\" (input)=\"staffSearch.set(\$any(\$event.target).value)\" placeholder=\"Filtrer staff...\" class=\"w-full px-3 py-1.5 text-xs rounded-lg border border-slate-100 mb-2 outline-none focus:border-emerald-300\">" "$HTML_FILE"

echo "✅ Filtres ajoutés. Vous pouvez maintenant rechercher vos prestataires et votre staff par nom."