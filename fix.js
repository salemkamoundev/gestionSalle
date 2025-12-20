const fs = require('fs');

// --- CONFIGURATION ---
const paths = {
  routes: 'src/app/app.routes.ts',
  layout: 'src/app/layout/main-layout/main-layout.component.html'
};

// --- CONTENU A INJECTER ---
const importLine = "import { ExpenseManagerComponent } from './features/finances/expense-manager/expense-manager.component';";
const routeDefinition = `
  { 
    path: 'depenses', 
    component: ExpenseManagerComponent, 
    title: 'Gestion des Dépenses' 
  },`;

const menuLinkHtml = `
      <a routerLink="/depenses" routerLinkActive="active" class="nav-link flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
        <i class="fa-solid fa-money-bill-wave h-4 w-4"></i>
        <span>Dépenses</span>
      </a>`;

// --- FONCTION DE MISE A JOUR ---
function updateProject() {
  
  // 1. UPDATE ROUTES
  try {
    let routesContent = fs.readFileSync(paths.routes, 'utf8');
    
    if (!routesContent.includes('ExpenseManagerComponent')) {
      // Ajouter l'import au début
      routesContent = importLine + '\n' + routesContent;
      
      // Ajouter la route au début du tableau routes
      routesContent = routesContent.replace(
        'export const routes: Routes = [',
        'export const routes: Routes = [' + routeDefinition
      );
      
      fs.writeFileSync(paths.routes, routesContent);
      console.log('✅ Route "depenses" ajoutée dans app.routes.ts');
    } else {
      console.log('ℹ️ La route semble déjà exister.');
    }
  } catch (err) {
    console.error('❌ Erreur avec app.routes.ts :', err.message);
  }

  // 2. UPDATE MENU HTML
  try {
    let layoutContent = fs.readFileSync(paths.layout, 'utf8');
    
    if (!layoutContent.includes('/depenses')) {
      // On cherche la dernière balise fermante de lien </a> pour insérer après
      const lastLinkIndex = layoutContent.lastIndexOf('</a>');
      
      if (lastLinkIndex !== -1) {
        const newContent = 
          layoutContent.slice(0, lastLinkIndex + 4) + 
          '\n' + menuLinkHtml + 
          layoutContent.slice(lastLinkIndex + 4);
          
        fs.writeFileSync(paths.layout, newContent);
        console.log('✅ Bouton ajouté dans main-layout.component.html');
      } else {
        console.log('⚠️ Pas de balise </a> trouvée pour insérer le lien automatiquement.');
      }
    } else {
      console.log('ℹ️ Le bouton semble déjà exister dans le menu.');
    }
  } catch (err) {
    console.error('❌ Erreur avec main-layout.component.html :', err.message);
  }
}

updateProject();