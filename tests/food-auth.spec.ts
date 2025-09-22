import { test, expect } from './fixtures/supabase';
import { createTestScenario, cleanupTestData, assertRecentDataCount } from './fixtures/supabase';

// ===========================
// Tests avec fixtures Supabase et authentification préalable
// ===========================

test.describe('Application de suivi des tétées (avec authentification préalable)', () => {
  // Nettoyer les données avant et après chaque test
  test.beforeEach(async ({ supabaseClient }) => {
    // Nettoyer avant chaque test
    await cleanupTestData();
    // Attendre plus longtemps pour s'assurer que le nettoyage est terminé
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test('affichage du dashboard avec données de test', async ({ page, testData }) => {
    // Préparer un scénario avec des données de test
    await createTestScenario('basic');
    
    // Attendre que les données soient insérées
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Aller directement sur la page food (déjà connecté grâce à storageState)
    await page.goto('/');
    
    // Attendre que la page se charge complètement
    await page.waitForLoadState('networkidle');
    
    // Vérifier que le dashboard s'affiche correctement
    await expect(page.getByTestId('page-title')).toBeVisible();
    await expect(page.locator('[data-testid="today-block"]')).toBeVisible();
    
    // Vérifier que le compteur affiche les données de test (2 tétées)
    // Attendre que le compteur se mette à jour
    await page.waitForFunction(() => {
      const counter = document.querySelector('[data-testid="today-block"] .text-3xl');
      return counter && counter.textContent !== '0';
    }, { timeout: 10000 });
    
    await expect(page.locator('[data-testid="today-block"] .text-3xl')).toHaveText('2');
    
    // Vérifier que les sections principales sont présentes
    await expect(page.locator('text=Today')).toBeVisible();
    await expect(page.locator('text=Timeline')).toBeVisible();
  });

  test('vérifier le compteur avec données existantes', async ({ page, testData }) => {
    // Préparer un scénario avec des données
    await createTestScenario('basic');
    
    // Attendre que les données soient insérées
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Aller directement sur la page food (déjà connecté)
    await page.goto('/');
    
    // Attendre que la page se charge complètement
    await page.waitForLoadState('networkidle');
    
    // Vérifier que le bloc "Aujourd'hui" existe
    await expect(page.locator('[data-testid="today-block"]')).toBeVisible();
    
    // Vérifier que le compteur affiche le bon nombre (2 tétées aujourd'hui)
    // Attendre que le compteur se mette à jour
    await page.waitForFunction(() => {
      const counter = document.querySelector('[data-testid="today-block"] .text-3xl');
      return counter && counter.textContent !== '0';
    }, { timeout: 10000 });
    
    await expect(page.locator('[data-testid="today-block"] .text-3xl')).toHaveText('2');
  });

  test('test complet avec données complètes', async ({ page, testData }) => {
    // Préparer un scénario complet
    await createTestScenario('full');
    
    // Aller directement sur la page food (déjà connecté)
    await page.goto('/');
    
    // Vérifier que tous les éléments sont présents
    await expect(page.locator('text=Today')).toBeVisible();
    await expect(page.locator('span:has-text("Predictions")')).toBeVisible();
    await expect(page.locator('text=Feeding Timeline')).toBeVisible();
    await expect(page.locator('text=Interval Statistics')).toBeVisible();
    
    // Vérifier que les graphiques se chargent
    await expect(page.locator('[data-testid="today-block"]')).toBeVisible();
  });

  test('test de la fonctionnalité d\'ajout avec vérification base de données', async ({ page, testData, supabaseClient }) => {
    // Préparer un scénario de base
    await createTestScenario('basic');
    
    // Vérifier l'état initial de la base
    await assertRecentDataCount(2);
    
    // Aller directement sur la page food (déjà connecté)
    await page.goto('/');
    
    // Compter les tétées avant ajout
    const beforeCount = await page.locator('[data-testid="today-block"] .text-3xl').textContent();
    const beforeCountNum = parseInt(beforeCount || '0');
    
    // Ajouter une tétée (bouton Right)
    await page.click('.rounded-full:has-text("R"):has-text("ight")');
    
    // Attendre le message de succès
    await expect(page.locator('.text-green-800:has-text("Feeding saved!")')).toBeVisible();
    
    // Attendre que l'ajout se traite
    await page.waitForTimeout(1000); // Attendre la mise à jour
    const afterCount = await page.locator('[data-testid="today-block"] .text-3xl').textContent();
    const afterCountNum = parseInt(afterCount || '0');
    
    expect(afterCountNum).toBeGreaterThan(beforeCountNum);
    
    // Vérifier que la base de données a été mise à jour
    await assertRecentDataCount(3);
  });

  test('test de la déconnexion', async ({ page, testData }) => {
    // Préparer des données
    await createTestScenario('basic');
    
    // Aller directement sur la page food (déjà connecté)
    await page.goto('/');
    
    // Vérifier qu'on est connecté
    await expect(page.getByTestId('page-title')).toBeVisible();
    
    // Se déconnecter
    await page.click('button:has-text("Logout")');
    
    // Vérifier qu'on est déconnecté (retour au formulaire de connexion)
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
