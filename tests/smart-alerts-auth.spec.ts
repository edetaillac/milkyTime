import { test, expect, DEFAULT_USER_ID } from './fixtures/supabase';
import { createTestScenario, cleanupTestData } from './fixtures/supabase';

test.describe('Tests des alertes intelligentes avec authentification préalable', () => {
  test.beforeEach(async () => {
    // Nettoyer avant chaque test
    await cleanupTestData();
    // Attendre un peu pour s'assurer que le nettoyage est terminé
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test('test alerte intelligente - dans la fenêtre (bloc vert)', async ({ page, testData }) => {
    // Préparer un scénario avec des tétées récentes pour créer une prédiction
    await createTestScenario('basic');
    
    // Aller directement sur la page food (déjà connecté grâce à storageState)
    await page.goto('/');
    
    // Attendre que la page se charge complètement
    await page.waitForTimeout(2000);
    
    // Vérifier que les alertes intelligentes s'affichent
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Predictions' })).toBeVisible();
    
    // Vérifier que le bloc "Aujourd'hui" est vert (dans la fenêtre)
    const todayBlock = page.locator('[data-testid="today-block"]');
    await expect(todayBlock).toBeVisible();
    
    // Vérifier que le bloc a la classe verte (dans la fenêtre)
    await expect(todayBlock).toHaveClass(/bg-green/);
    
    // Vérifier que la prédiction s'affiche
    await expect(page.locator('text=Next at')).toBeVisible();

    // Vérifier que la prédiction s'affiche
    await expect(page.locator('text=Start :')).toBeVisible();
    await expect(page.locator('text=End :')).toBeVisible();
  });

  test('test alerte intelligente - avant la fenêtre (bloc rouge)', async ({ page, testData, supabaseClient }) => {
    // Préparer un scénario avec des tétées très récentes (pas encore dans la fenêtre)
    const now = new Date();
    const recentFeedings = [
      { side: "left" as const, timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), user_id: DEFAULT_USER_ID }, // 10min ago
      { side: "right" as const, timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), user_id: DEFAULT_USER_ID }, // 30min ago
    ];
    
    // Insérer directement les données de test
    await supabaseClient.from("food_logs").insert(recentFeedings);
    
    // Aller directement sur la page food (déjà connecté grâce à storageState)
    await page.goto('/');
    
    // Attendre que la page se charge complètement
    await page.waitForTimeout(2000);
    
    // Vérifier que les alertes intelligentes s'affichent
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Predictions' })).toBeVisible();
    
    // Vérifier que le bloc "Aujourd'hui" est rouge (avant la fenêtre)
    const todayBlock = page.locator('[data-testid="today-block"]');
    await expect(todayBlock).toBeVisible();
    
    // Vérifier que le bloc a la classe rouge (avant la fenêtre)
    await expect(todayBlock).toHaveClass(/bg-red/);
  });

  test('test alerte intelligente - après la fenêtre (bloc vert)', async ({ page, testData, supabaseClient }) => {
    // Préparer un scénario avec des tétées anciennes (après la fenêtre)
    const now = new Date();
    const oldFeedings = [
      { side: "left" as const, timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(), user_id: DEFAULT_USER_ID }, // 4h ago
      { side: "right" as const, timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(), user_id: DEFAULT_USER_ID }, // 8h ago
    ];
    
    // Insérer directement les données de test
    await supabaseClient.from("food_logs").insert(oldFeedings);
    
    // Aller directement sur la page food (déjà connecté grâce à storageState)
    await page.goto('/');
    
    // Attendre que la page se charge complètement
    await page.waitForTimeout(2000);
    
    // Vérifier que les alertes intelligentes s'affichent
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Predictions' })).toBeVisible();
    
    // Vérifier que le bloc "Aujourd'hui" est vert (après la fenêtre)
    const todayBlock = page.locator('[data-testid="today-block"]');
    await expect(todayBlock).toBeVisible();
    
    // Vérifier que le bloc a la classe verte (après la fenêtre)
    await expect(todayBlock).toHaveClass(/bg-green/);

    // Vérifier que la prédiction s'affiche
    await expect(page.locator('text=Start :')).toBeVisible();
    await expect(page.locator('text=End :')).toBeVisible();
  });

  test('test nouvelles fonctionnalités - indicateur de fiabilité et cluster feeding', async ({ page, testData, supabaseClient }) => {
    // Préparer un scénario avec beaucoup de tétées pour tester la fiabilité
    const now = new Date();
    const manyFeedings: any[] = [];
    
    // Créer 15 tétées sur les dernières 24h pour avoir une prédiction fiable
    for (let i = 0; i < 15; i++) {
      const hoursAgo = i * 1.5; // Toutes les 1h30
      manyFeedings.push({
        side: i % 2 === 0 ? "left" : "right" as const,
        timestamp: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString(),
        user_id: DEFAULT_USER_ID,
      });
    }
    
    // Insérer directement les données de test
    await supabaseClient.from("food_logs").insert(manyFeedings);
    
    // Aller directement sur la page food (déjà connecté grâce à storageState)
    await page.goto('/');
    
    // Attendre que la page se charge complètement
    await page.waitForTimeout(3000);
    
    // DEBUG : Capturer le contenu de la page pour voir ce qui s'affiche
    const pageContent = await page.content();
    console.log('🔍 Contenu de la page :', pageContent.substring(0, 2000));
    
    // Vérifier que les alertes intelligentes s'affichent
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Predictions' })).toBeVisible();
    
    // DEBUG : Chercher tous les textes contenant "Prédiction" ou "tétées analysées"
    const predictionTexts = await page.locator('text=/Prédiction|tétées analysées/').allTextContents();
    console.log('🔍 Textes de prédiction trouvés :', predictionTexts);
    
    // Vérifier que l'indicateur de fiabilité s'affiche (devrait être "high" avec 15 tétées)
    await expect(page.locator('text=Reliability: 92%🟢')).toBeVisible();
    
  });

  test('test alerte intelligente - évolution de la couleur après ajout de tétée', async ({ page, testData }) => {
    // Préparer un scénario avec des tétées récentes
    await createTestScenario('basic');
    
    // Aller directement sur la page food (déjà connecté grâce à storageState)
    await page.goto('/');
    
    // Attendre que la page se charge complètement
    await page.waitForTimeout(2000);
    
    // Vérifier que le bloc "Aujourd'hui" est vert initialement
    const todayBlock = page.locator('[data-testid="today-block"]');
    await expect(todayBlock).toHaveClass(/bg-green/);
    
    // Ajouter une nouvelle tétée
    await page.click('.rounded-full:has-text("R"):has-text("ight")');
    
    // Attendre le message de succès
    await expect(page.locator('text=Feeding saved')).toBeVisible();
    
    // Attendre que la page se mette à jour
    await page.waitForTimeout(2000);
    
    // Vérifier que le bloc "Aujourd'hui" est maintenant rouge (reset de la fenêtre)
    await expect(todayBlock).toHaveClass(/bg-red/);
  });

  test('test alerte intelligente - prédiction et fenêtre probable', async ({ page, testData }) => {
    // Préparer un scénario avec des données complètes pour avoir une prédiction fiable
    await createTestScenario('full');
    
    // Aller directement sur la page food (déjà connecté grâce à storageState)
    await page.goto('/');
    
    // Attendre que la page se charge complètement
    await page.waitForTimeout(2000);
    
    // Vérifier que les alertes intelligentes s'affichent
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Predictions' })).toBeVisible();
    
    // Vérifier que la prédiction s'affiche
    await expect(page.locator('text=Next at')).toBeVisible();
    
     // Vérifier que la prédiction s'affiche
     await expect(page.locator('text=Start :')).toBeVisible();
     await expect(page.locator('text=End :')).toBeVisible();
    
    // Vérifier que le bloc "Aujourd'hui" a une couleur appropriée
    const todayBlock = page.locator('[data-testid="today-block"]');
    await expect(todayBlock).toBeVisible();
    
    // Le bloc devrait être soit vert soit rouge selon la position dans la fenêtre
    const hasGreenClass = await todayBlock.evaluate(el => el.className.includes('bg-green'));
    const hasRedClass = await todayBlock.evaluate(el => el.className.includes('bg-red'));
    
    expect(hasGreenClass || hasRedClass).toBe(true);
  });
});
