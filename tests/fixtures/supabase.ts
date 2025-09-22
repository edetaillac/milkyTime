import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// ===========================
// Configuration Supabase pour les tests
// ===========================
// Next.js charge automatiquement .env.test pour l'app, mais pas pour les scripts de test
dotenv.config({ path: '.env.test' });

const isTestEnvironment = process.env.NODE_ENV === 'test'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ⚠️ PROTECTION SIMPLE ET EFFICACE
if (!isTestEnvironment) {
  throw new Error(`
🚨 SÉCURITÉ: Tests autorisés uniquement avec NODE_ENV=test !
   NODE_ENV actuel: ${process.env.NODE_ENV}
`)
}

// Protection générique contre les URLs de production
const suspiciousKeywords = ['prod', 'production', 'live', 'main', 'master'];
const hasSuspiciousKeyword = suspiciousKeywords.some(keyword => 
  supabaseUrl?.toLowerCase().includes(keyword)
);

if (hasSuspiciousKeyword) {
  throw new Error(`
🚨 ALERTE: URL SUSPECTE DÉTECTÉE !
   URL: ${supabaseUrl}
   
   Les URLs contenant 'prod', 'production', 'live', etc. sont interdites en test.
   Utilisez une base de données de test dédiée.
`)
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`
🚨 Variables Supabase manquantes !
   Vérifiez votre fichier .env.test
`)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log(`🧪 Tests configurés avec: ${supabaseUrl}`)
console.log(`🔒 Mode test activé: ${isTestEnvironment}`)

// ===========================
// Types pour les fixtures
// ===========================

export interface TestFeeding {
  id?: string
  side: "left" | "right"
  timestamp: string
  created_at?: string
  user_id?: string
}

export interface TestUser {
  id: string
  username: string
  password: string
  babyBirthDate: string
}

// ===========================
// Données de test - Cohérentes avec USERS_DATA
// ===========================

// Utilisateur de test (doit correspondre à USERS_DATA dans .env.test)
export const TEST_USERS = {
  default: {
    id: "550e8400-e29b-41d4-a716-446655440001",
    username: "test",
    password: "test",
    babyBirthDate: "2025-07-25"
  }
} as const

export const DEFAULT_USER_ID = TEST_USERS.default.id

export const TEST_FEEDINGS: TestFeeding[] = [
  {
    side: "left",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // Il y a 2h
    user_id: DEFAULT_USER_ID,
  },
  {
    side: "right",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // Il y a 4h
    user_id: DEFAULT_USER_ID,
  },
  {
    side: "left",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // Il y a 6h
    user_id: DEFAULT_USER_ID,
  },
  {
    side: "right",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // Il y a 8h
    user_id: DEFAULT_USER_ID,
  },
  {
    side: "left",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Il y a 24h
    user_id: DEFAULT_USER_ID,
  }
]

// ===========================
// Helpers pour la gestion des fixtures
// ===========================

/**
 * Nettoie les données récentes (utilisé pour les tests)
 */
export async function cleanupTestData() {
  // ⚠️ TRIPLE PROTECTION: Empêcher la suppression sur la production
  if (!isTestEnvironment) {
    throw new Error(`
🚨 SÉCURITÉ: Tentative de nettoyage sur un environnement non-test !
   Le nettoyage des données est INTERDIT en production.
   Définir NODE_ENV=test pour les tests.
`)
  }
  
  // ⚠️ Vérification supplémentaire de l'URL
  if (supabaseUrl && (
    supabaseUrl.includes('prod') || 
    supabaseUrl.includes('production') ||
    supabaseUrl.includes('live')
  )) {
    throw new Error(`
🚨 DANGER: L'URL Supabase contient des termes de production !
   URL actuelle: ${supabaseUrl}
   
   Utilisez une base de données de TEST séparée !
`)
  }

  try {
    console.log("🧹 Nettoyage des données de test...")
    console.log(`🔗 Base utilisée: ${supabaseUrl}`)
    console.log(`🔒 Mode test: ${isTestEnvironment}`)
    
    // Nettoyage moins agressif - seulement les données récentes de test
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { error } = await supabase
      .from("food_logs")
      .delete()
      .gte("timestamp", cutoffDate) // Supprimer seulement les dernières 24h
    
    if (error) {
      console.error("Erreur lors du nettoyage des données de test:", error)
    } else {
      console.log("✅ Données de test nettoyées (dernières 24h)")
    }
  } catch (error) {
    console.error("Erreur lors du nettoyage:", error)
    throw error
  }
}

/**
 * Insère des données de test dans la base
 */
export async function seedTestData(feedings: TestFeeding[] = TEST_FEEDINGS) {
  try {
    const withUserIds = feedings.map((f) => ({
      ...f,
      user_id: f.user_id ?? DEFAULT_USER_ID,
    }))
    // Insérer les nouvelles données
    const { data, error } = await supabase
      .from("food_logs")
      .insert(withUserIds)
      .select()
    
    if (error) {
      console.error("Erreur lors de l'insertion des données de test:", error)
      throw error
    }
    
    console.log(`✅ ${data?.length || 0} tétées de test insérées`)
    return data
  } catch (error) {
    console.error("Erreur lors du seeding:", error)
    throw error
  }
}

/**
 * Crée un jeu de données spécifique pour un test
 */
export async function createTestScenario(scenario: "empty" | "basic" | "full" | "night-heavy" | "day-heavy" | "record-bronze" | "record-silver" | "record-gold" | "no-records" | "record-bronze-only" | "record-bronze-silver" | "record-all" | "record-absolute-with-history") {
  const now = new Date()
  
  switch (scenario) {
    case "empty":
      await cleanupTestData()
      return []
      
    case "basic":
      return await seedTestData([
        {
          side: "left",
          timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
        },
        {
          side: "right",
          timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
        }
      ])
      
    case "full":
      return await seedTestData(TEST_FEEDINGS)
      
    case "night-heavy":
      const nightFeedings = [
        { side: "left" as const, timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString() }, // 1h ago
        { side: "right" as const, timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString() }, // 4h ago (nuit)
        { side: "left" as const, timestamp: new Date(now.getTime() - 7 * 60 * 60 * 1000).toISOString() }, // 7h ago (nuit)
        { side: "right" as const, timestamp: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString() }, // 10h ago (nuit)
      ]
      return await seedTestData(nightFeedings)
      
    case "day-heavy":
      const dayFeedings = [
        { side: "left" as const, timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() }, // 2h ago
        { side: "right" as const, timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString() }, // 5h ago
        { side: "left" as const, timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString() }, // 8h ago
        { side: "right" as const, timestamp: new Date(now.getTime() - 11 * 60 * 60 * 1000).toISOString() }, // 11h ago
      ]
      return await seedTestData(dayFeedings)
      
    case "no-records":
      // Scénario avec des records existants élevés, nouvelle tétée ne bat rien
      const noRecordsFeedings = [
        { side: "left" as const, timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString() }, // 15min ago (nouvelle tétée)
        { side: "right" as const, timestamp: new Date(now.getTime() - 75 * 60 * 1000).toISOString() }, // 1h15 ago (intervalle 60min)
        { side: "left" as const, timestamp: new Date(now.getTime() - 135 * 60 * 1000).toISOString() }, // 2h15 ago (intervalle 60min)
        { side: "right" as const, timestamp: new Date(now.getTime() - 195 * 60 * 1000).toISOString() }, // 3h15 ago (intervalle 60min)
      ]
      return await seedTestData(noRecordsFeedings)
      
    case "record-bronze":
      // Scénario pour déclencher un record bronze
      // Créer d'abord des records existants à battre (50min, 60min, 70min)
      // Puis ajouter une tétée qui va créer un intervalle de 65min (qui bat le bronze à 50min)
      const bronzeFeedings = [
        { side: "left" as const, timestamp: new Date(now.getTime() - 65 * 60 * 1000).toISOString() }, // 65min ago (nouvelle tétée)
        { side: "right" as const, timestamp: new Date(now.getTime() - 115 * 60 * 1000).toISOString() }, // 1h55 ago (intervalle 50min)
        { side: "left" as const, timestamp: new Date(now.getTime() - 175 * 60 * 1000).toISOString() }, // 2h55 ago (intervalle 60min)
        { side: "right" as const, timestamp: new Date(now.getTime() - 245 * 60 * 1000).toISOString() }, // 4h05 ago (intervalle 70min)
      ]
      return await seedTestData(bronzeFeedings)
      
    case "record-silver":
      // Scénario pour déclencher un record argent
      // Créer des records existants (50min, 60min, 70min)
      // Puis ajouter une tétée qui va créer un intervalle de 75min (qui bat l'argent à 60min)
      const silverFeedings = [
        { side: "left" as const, timestamp: new Date(now.getTime() - 75 * 60 * 1000).toISOString() }, // 75min ago (nouvelle tétée)
        { side: "right" as const, timestamp: new Date(now.getTime() - 125 * 60 * 1000).toISOString() }, // 2h05 ago (intervalle 50min)
        { side: "left" as const, timestamp: new Date(now.getTime() - 185 * 60 * 1000).toISOString() }, // 3h05 ago (intervalle 60min)
        { side: "right" as const, timestamp: new Date(now.getTime() - 255 * 60 * 1000).toISOString() }, // 4h15 ago (intervalle 70min)
      ]
      return await seedTestData(silverFeedings)
      
    case "record-gold":
      // Scénario pour déclencher un record or
      // Créer des records existants (50min, 60min, 70min)
      // Puis ajouter une tétée qui va créer un intervalle de 85min (qui bat l'or à 70min)
      const goldFeedings = [
        { side: "left" as const, timestamp: new Date(now.getTime() - 85 * 60 * 1000).toISOString() }, // 85min ago (nouvelle tétée)
        { side: "right" as const, timestamp: new Date(now.getTime() - 135 * 60 * 1000).toISOString() }, // 2h15 ago (intervalle 50min)
        { side: "left" as const, timestamp: new Date(now.getTime() - 195 * 60 * 1000).toISOString() }, // 3h15 ago (intervalle 60min)
        { side: "right" as const, timestamp: new Date(now.getTime() - 265 * 60 * 1000).toISOString() }, // 4h25 ago (intervalle 70min)
      ]
      return await seedTestData(goldFeedings)
      
    case "record-bronze-only":
      // Scénario pour battre seulement le bronze (☀️ 🥉 battu)
      // Créer des records existants (50min, 60min, 70min)
      // Puis ajouter une tétée qui va créer un intervalle de 55min (qui bat seulement le bronze à 50min)
      const bronzeOnlyFeedings = [
        { side: "left" as const, timestamp: new Date(now.getTime() - 55 * 60 * 1000).toISOString() }, // 55min ago (nouvelle tétée)
        { side: "right" as const, timestamp: new Date(now.getTime() - 105 * 60 * 1000).toISOString() }, // 1h45 ago (intervalle 50min)
        { side: "left" as const, timestamp: new Date(now.getTime() - 165 * 60 * 1000).toISOString() }, // 2h45 ago (intervalle 60min)
        { side: "right" as const, timestamp: new Date(now.getTime() - 235 * 60 * 1000).toISOString() }, // 3h55 ago (intervalle 70min)
      ]
      return await seedTestData(bronzeOnlyFeedings)
      
    case "record-bronze-silver":
      // Scénario pour battre bronze et argent (☀️ 🥈 🥉 battu)
      // Créer des records existants (50min, 60min, 70min)
      // Puis ajouter une tétée qui va créer un intervalle de 65min (qui bat bronze et argent)
      const bronzeSilverFeedings = [
        { side: "left" as const, timestamp: new Date(now.getTime() - 65 * 60 * 1000).toISOString() }, // 65min ago (nouvelle tétée)
        { side: "right" as const, timestamp: new Date(now.getTime() - 115 * 60 * 1000).toISOString() }, // 1h55 ago (intervalle 50min)
        { side: "left" as const, timestamp: new Date(now.getTime() - 175 * 60 * 1000).toISOString() }, // 2h55 ago (intervalle 60min)
        { side: "right" as const, timestamp: new Date(now.getTime() - 245 * 60 * 1000).toISOString() }, // 4h05 ago (intervalle 70min)
      ]
      return await seedTestData(bronzeSilverFeedings)
      
    case "record-all":
      // Scénario pour battre tous les records (☀️ 🥇 🥈 🥉 battu)
      // Créer des records existants (50min, 60min, 70min)
      // Puis ajouter une tétée qui va créer un intervalle de 85min (qui bat tous les records)
      const allRecordsFeedings = [
        { side: "left" as const, timestamp: new Date(now.getTime() - 85 * 60 * 1000).toISOString() }, // 85min ago (nouvelle tétée)
        { side: "right" as const, timestamp: new Date(now.getTime() - 135 * 60 * 1000).toISOString() }, // 2h15 ago (intervalle 50min)
        { side: "left" as const, timestamp: new Date(now.getTime() - 195 * 60 * 1000).toISOString() }, // 3h15 ago (intervalle 60min)
        { side: "right" as const, timestamp: new Date(now.getTime() - 265 * 60 * 1000).toISOString() }, // 4h25 ago (intervalle 70min)
      ]
      return await seedTestData(allRecordsFeedings)
      
    case "record-absolute-with-history":
      // Scénario pour battre un record absolu avec beaucoup d'historique
      // Utilise la logique proposée : patterns d'intervalles répétitifs
      
      const feedings: TestFeeding[] = []
      let lastFeeding = new Date(now.getTime() - 5 * 60 * 60 * 1000) // Commencer à maintenant - 5h (plus récente)
      
      // Fonction helper pour ajouter une tétée de base (1h avant la dernière)
      const addDefaultFeeding = (lastFeed: Date) => {
        const feedingTime = new Date(lastFeed.getTime() - 1 * 60 * 60 * 1000)
        return { side: "left" as const, timestamp: feedingTime.toISOString() }
      }
      
      // Fonction helper pour ajouter une tétée avec délai spécifique
      const addFeeding = (lastFeed: Date, delayHours: number) => {
        const feedingTime = new Date(lastFeed.getTime() - delayHours * 60 * 60 * 1000)
        return { side: "right" as const, timestamp: feedingTime.toISOString() }
      }
      
      // Premier cycle : 2 → 5
      for (let x = 2; x <= 5; x++) {
        // 10 tétées de base (1h d'intervalle)
        for (let i = 0; i < 10; i++) {
          const feeding = addDefaultFeeding(lastFeeding)
          feedings.unshift(feeding) // Ajouter au début pour garder l'ordre chronologique
          lastFeeding = new Date(feeding.timestamp)
        }
        // Une tétée espacée (x heures)
        const feeding = addFeeding(lastFeeding, x)
        feedings.unshift(feeding)
        lastFeeding = new Date(feeding.timestamp)
      }
      
      // Deuxième cycle : 5 → 2
      for (let x = 5; x >= 2; x--) {
        // 10 tétées de base (1h d'intervalle)
        for (let i = 0; i < 10; i++) {
          const feeding = addDefaultFeeding(lastFeeding)
          feedings.unshift(feeding)
          lastFeeding = new Date(feeding.timestamp)
        }
        // Une tétée espacée (x heures)
        const feeding = addFeeding(lastFeeding, x)
        feedings.unshift(feeding)
        lastFeeding = new Date(feeding.timestamp)
      }
      
      // Ajouter quelques tétées supplémentaires pour avoir plus de données
      for (let i = 0; i < 20; i++) {
        const feeding = addDefaultFeeding(lastFeeding)
        feedings.unshift(feeding)
        lastFeeding = new Date(feeding.timestamp)
      }
      
      // La tétée la plus récente est déjà fixée à maintenant - 6h via lastFeeding ci-dessus.
      
      console.log(`🔍 Créé ${feedings.length} tétées avec la nouvelle logique`)
      return await seedTestData(feedings)
      
    default:
      return await seedTestData()
  }
}

/**
 * Récupère les données récentes (pour les tests)
 */
export async function getRecentData() {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const { data, error } = await supabase
      .from("food_logs")
      .select("*")
      .gte("timestamp", yesterday.toISOString())
      .order("timestamp", { ascending: false })
    
    if (error) {
      console.error("Erreur lors de la récupération des données:", error)
      throw error
    }
    
    return data || []
  } catch (error) {
    console.error("Erreur lors de la récupération:", error)
    throw error
  }
}

/**
 * Vérifie que la base contient le bon nombre de données récentes
 */
export async function assertRecentDataCount(expectedCount: number) {
  const data = await getRecentData()
  if (data.length !== expectedCount) {
    throw new Error(`Nombre de données récentes incorrect: attendu ${expectedCount}, trouvé ${data.length}`)
  }
  return data
}

// ===========================
// Fixtures Playwright
// ===========================

import { test as base } from '@playwright/test'

// Définir les fixtures personnalisées
export const test = base.extend<{
  supabaseClient: typeof supabase
  testData: {
    user: TestUser
    feedings: TestFeeding[]
  }
}>({
  supabaseClient: async ({}, use) => {
    await use(supabase)
  },
  
  testData: async ({}, use) => {
    await use({
      user: TEST_USERS.default,
      feedings: TEST_FEEDINGS
    })
  }
})

export { expect } from '@playwright/test'
