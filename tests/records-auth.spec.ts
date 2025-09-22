import { test, expect } from './fixtures/supabase';
import { createTestScenario, cleanupTestData } from './fixtures/supabase';

test.describe('Tests des records avec authentification préalable', () => {
  test.beforeEach(async () => {
    // Nettoyer avant chaque test
    await cleanupTestData();
    // Attendre un peu pour s'assurer que le nettoyage est terminé
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test('test sans records - pas de confettis', async ({ page, testData }) => {
    // Préparer un scénario sans records
    await createTestScenario('no-records');
    
    // Aller directement sur la page food (déjà connecté grâce à storageState)
    await page.goto('/');
    
    // Ajouter une tétée (ne devrait pas déclencher de record)
    await page.click('.rounded-full:has-text("L"):has-text("eft")');
    
    // Attendre le message de succès
    await expect(page.locator('text=Feeding saved!')).toBeVisible();
    
    // Vérifier qu'aucun confetti ne s'affiche (pas de popin de record)
    await page.waitForTimeout(3000);
    const confettiElements = await page.locator('[data-testid="confetti"], .confetti, [class*="confetti"], canvas').count();
    expect(confettiElements).toBe(0);
    
    // Vérifier qu'aucun popin de record ne s'affiche
    const recordPopin = await page.locator('text=🎉 NEW RECORD ! 🎉').count();
    expect(recordPopin).toBe(0);
  });

  test('test record bronze seulement - ☀️ 🥉 battu', async ({ page, testData }) => {
    // Préparer un scénario pour battre seulement le bronze
    await createTestScenario('record-bronze-only');
    
    // Aller directement sur la page food (déjà connecté grâce à storageState)
    await page.goto('/');
    
    // Attendre que la page se charge complètement
    await page.waitForTimeout(2000);
    
    // Ajouter une nouvelle tétée qui va créer un intervalle de 55min (qui bat seulement le bronze)
    await page.click('.rounded-full:has-text("R"):has-text("ight")');
    
    // Attendre le message de succès
    await expect(page.locator('text=Feeding saved!')).toBeVisible();
    
    // Attendre et vérifier que les confettis s'affichent
    await page.waitForTimeout(3000);
    
    // Vérifier qu'un popin de record s'affiche
    await expect(page.locator('text=🎉 NEW RECORD ! 🎉')).toBeVisible();
    
    // Vérifier le pattern du record bronze seulement
    await expect(page.locator('text=☀️ record 🥉 broken')).toBeVisible();
    
    // Attendre un peu plus pour que le pop-in se charge complètement
    await page.waitForTimeout(1000);
    
    // Vérifier les détails de l'amélioration (bat seulement le bronze)
    await expect(page.locator('text=Old record : 50min')).toBeVisible();
    await expect(page.locator('text=Improvement : +5min')).toBeVisible();
    
    // Vérifier que les confettis sont présents
    const confettiElements = await page.locator('[data-testid="confetti"], .confetti, [class*="confetti"], canvas').count();
    expect(confettiElements).toBeGreaterThan(0);
  });

  test('test record bronze et argent - ☀️ records 🥈 🥉 broken', async ({ page, testData }) => {
    // Préparer un scénario pour battre bronze et argent
    await createTestScenario('record-bronze-silver');
    
    // Aller directement sur la page food (déjà connecté grâce à storageState)
    await page.goto('/');
    
    // Attendre que la page se charge complètement
    await page.waitForTimeout(2000);
    
    // Ajouter une nouvelle tétée qui va créer un intervalle de 65min (qui bat bronze et argent)
    await page.click('.rounded-full:has-text("L"):has-text("eft")');
    
    // Attendre le message de succès
    await expect(page.locator('text=Feeding saved!')).toBeVisible();
    
    // Attendre et vérifier que les confettis s'affichent
    await page.waitForTimeout(3000);
    
    // Vérifier qu'un popin de record s'affiche
    await expect(page.locator('text=🎉 NEW RECORD ! 🎉')).toBeVisible();
    
    // Vérifier le pattern du record bronze et argent
    // Le libellé utilise le pluriel ("battus !") quand plusieurs records sont battus
    await expect(page.locator('[role="dialog"]')).toContainText('🥈');
    await expect(page.locator('[role="dialog"]')).toContainText('🥉');
    await expect(page.locator('[role="dialog"]')).toContainText('broken');
    
    // Attendre un peu plus pour que le pop-in se charge complètement
    await page.waitForTimeout(1000);
    
    // Vérifier les détails de l'amélioration (bat bronze et argent, affiche l'argent)
    await expect(page.locator('text=Old record : 1h')).toBeVisible();
    await expect(page.locator('text=Improvement : +5min')).toBeVisible();
    
    // Vérifier que les confettis sont présents
    const confettiElements = await page.locator('[data-testid="confetti"], .confetti, [class*="confetti"], canvas').count();
    expect(confettiElements).toBeGreaterThan(0);
  });

  test('test record tous les records - ☀️ records 🥇 🥈 🥉 broken', async ({ page, testData }) => {
    // Préparer un scénario pour battre tous les records
    await createTestScenario('record-all');
    
    // Aller directement sur la page food (déjà connecté grâce à storageState)
    await page.goto('/');
    
    // Attendre que la page se charge complètement
    await page.waitForTimeout(2000);
    
    // Ajouter une nouvelle tétée qui va créer un intervalle de 85min (qui bat tous les records)
    await page.click('.rounded-full:has-text("R"):has-text("ight")');
    
    // Attendre le message de succès
    await expect(page.locator('text=Feeding saved!')).toBeVisible();
    
    // Attendre et vérifier que les confettis s'affichent
    await page.waitForTimeout(3000);
    
    // Vérifier qu'un popin de record s'affiche
    await expect(page.locator('text=🎉 NEW RECORD ! 🎉')).toBeVisible();
    
    // Vérifier le pattern de tous les records battus
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toContainText('🥇')
    await expect(dialog).toContainText('🥈')
    await expect(dialog).toContainText('🥉')
    await expect(dialog).toContainText('broken')
  
    // Attendre un peu plus pour que le pop-in se charge complètement
    await page.waitForTimeout(1000);
    
    // Vérifier les détails de l'amélioration (bat tous les records, affiche l'or)
    await expect(page.locator('[role="dialog"]')).toContainText('Old record : 1h10');
    await expect(page.locator('[role="dialog"]')).toContainText('Improvement : +15min');
    
    // Vérifier que les confettis sont présents
    const confettiElements = await page.locator('[data-testid="confetti"], .confetti, [class*="confetti"], canvas').count();
    expect(confettiElements).toBeGreaterThan(0);
  });

  test('test record absolu avec historique - ☀️ 🥇 🥈 🥉 battu avec 50+ logs', async ({ page, testData }) => {
    // Préparer un scénario avec beaucoup d'historique et des records élevés
    await createTestScenario('record-absolute-with-history');
    
    // Aller directement sur la page food (déjà connecté grâce à storageState)
    await page.goto('/');
    
    // Attendre que la page se charge complètement (plus de temps car beaucoup de données)
    await page.waitForTimeout(3000);
    
    // Ajouter une nouvelle tétée qui va créer un intervalle de 3h30 (qui bat le record absolu à 3h)
    await page.click('.rounded-full:has-text("R"):has-text("ight")');
    
    // Attendre le message de succès
    await expect(page.locator('text=Feeding saved!')).toBeVisible();
    
    // Attendre et vérifier que les confettis s'affichent
    await page.waitForTimeout(3000);
    
    // Vérifier qu'un popin de record s'affiche
    await expect(page.locator('text=🎉 NEW RECORD ! 🎉')).toBeVisible();
    
    // Vérifier le pattern de tous les records battus (record absolu)
    const absoluteDialog = page.locator('[role="dialog"]')
    await expect(absoluteDialog).toContainText('🥇')
    await expect(absoluteDialog).toContainText('🥈')
    await expect(absoluteDialog).toContainText('🥉')
    await expect(absoluteDialog).toContainText('broken')
    
    // Attendre un peu plus pour que le pop-in se charge complètement
    await page.waitForTimeout(1000);
    
    // Vérifier les détails de l'amélioration (bat le record absolu à 5h)
    await expect(page.locator('[role="dialog"]')).toContainText('Old record : 5h');
    await expect(page.locator('[role="dialog"]')).toContainText('Improvement : +1h');
    
    // Vérifier que les confettis sont présents
    const confettiElements = await page.locator('[data-testid="confetti"], .confetti, [class*="confetti"], canvas').count();
    expect(confettiElements).toBeGreaterThan(0);
    
    // Vérifier que nous avons bien beaucoup de données historiques
    // (optionnel : vérifier que la page affiche bien l'historique)
    await expect(page.getByTestId('page-title')).toBeVisible();
  });
});