import { test, expect } from './fixtures/supabase';
import { cleanupTestData } from './fixtures/supabase';

// Fonction helper pour se connecter
async function login(page: any, testData: any) {
  await page.fill('input[type="text"]', testData.user.username);
  await page.fill('input[type="password"]', testData.user.password);
  await page.click('button:has-text("Login")');
  
  // Attendre que la connexion se fasse et que le dashboard se charge
  await page.waitForTimeout(2000); // Attendre que la connexion se traite
  await page.waitForSelector('[data-testid="page-title"]', { timeout: 10000 });
}

test.describe('Authentification', () => {
  test.beforeEach(async () => {
    // Nettoyer avant chaque test
    await cleanupTestData();
    // Attendre un peu pour s'assurer que le nettoyage est terminé
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test('connexion réussie et sauvegarde de l\'état', async ({ browser }) => {
    // Créer un contexte SANS état d'authentification pour ce test spécifique
    const context = await browser.newContext({
      // Pas de storageState pour ce test - on veut démarrer déconnecté
    });
    const page = await context.newPage();
    
    // Aller sur la page
    await page.goto('/');
    
    // Attendre que la page de connexion se charge
    await page.waitForSelector('text=Login');
    
    // Se connecter avec les données de test hardcodées
    await page.fill('input[type="text"]', 'test');
    await page.fill('input[type="password"]', 'test');
    await page.click('button:has-text("Login")');
    
    // Attendre que la connexion se fasse et que le dashboard se charge
    await page.waitForTimeout(2000);
    await page.waitForSelector('[data-testid="page-title"]', { timeout: 10000 });
    
    // Vérifier que la connexion a réussi
    await expect(page.getByTestId('page-title')).toBeVisible();
    
    // Sauvegarder l'état de connexion (cookies, localStorage, etc.)
    await page.context().storageState({ path: 'tests/auth-state.json' });
    
    console.log('✅ État d\'authentification sauvegardé');
    
    // Fermer le contexte
    await context.close();
  });
});
