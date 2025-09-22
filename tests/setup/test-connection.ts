import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// ===========================
// Script de test de connexion Supabase
// ===========================
// Charger .env.test pour les scripts non-Next.js
dotenv.config({ path: '.env.test' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ⚠️ PROTECTION: Vérifier l'environnement
if (process.env.NODE_ENV !== 'test') {
  console.error('🚨 ERREUR: Script autorisé uniquement avec NODE_ENV=test');
  console.error(`   NODE_ENV actuel: ${process.env.NODE_ENV}`);
  process.exit(1);
}

if (supabaseUrl?.includes('ddytdcwbxdmozvrgdsps')) {
  console.error('🚨 ERREUR: URL de production détectée !');
  console.error(`   URL: ${supabaseUrl}`);
  process.exit(1);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('Vérifiez que NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont définies');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('🔍 Test de connexion à Supabase...');
  console.log(`URL: ${supabaseUrl}`);
  console.log(`Clé: ${supabaseAnonKey.substring(0, 20)}...`);
  console.log('');

  try {
    // Test 1: Connexion de base
    console.log('📡 Test 1: Connexion de base...');
    const { data: healthData, error: healthError } = await supabase
      .from('food_logs')
      .select('count')
      .limit(1);
    
    if (healthError) {
      console.error('❌ Erreur de connexion:', healthError.message);
      return false;
    }
    
    console.log('✅ Connexion Supabase réussie !');
    console.log('✅ Table food_logs accessible');
    console.log('');

    // Test 2: Insertion de test
    console.log('📝 Test 2: Insertion de données de test...');
    const testData = {
      side: 'left' as const,
      timestamp: new Date().toISOString()
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('food_logs')
      .insert([testData])
      .select();
    
    if (insertError) {
      console.error('❌ Erreur d\'insertion:', insertError.message);
      return false;
    }
    
    console.log('✅ Insertion réussie !');
    console.log(`✅ ID créé: ${insertData?.[0]?.id}`);
    console.log('');

    // Test 3: Lecture de données
    console.log('📖 Test 3: Lecture de données...');
    const { data: readData, error: readError } = await supabase
      .from('food_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(5);
    
    if (readError) {
      console.error('❌ Erreur de lecture:', readError.message);
      return false;
    }
    
    console.log('✅ Lecture réussie !');
    console.log(`✅ ${readData?.length || 0} enregistrements trouvés`);
    console.log('');

    // Test 4: Suppression de test
    console.log('🗑️ Test 4: Suppression de données de test...');
    if (insertData?.[0]?.id) {
      const { error: deleteError } = await supabase
        .from('food_logs')
        .delete()
        .eq('id', insertData[0].id);
      
      if (deleteError) {
        console.error('❌ Erreur de suppression:', deleteError.message);
        return false;
      }
      
      console.log('✅ Suppression réussie !');
      console.log('');
    }

    // Test 5: Nettoyage sécurisé des données de test récentes
    console.log('🧹 Test 5: Nettoyage sécurisé des données de test...');
    console.log(`🔗 Base utilisée: ${supabaseUrl}`);
    console.log(`🔒 Mode test: ${process.env.NODE_ENV === 'test'}`);
    
    // Nettoyage beaucoup moins agressif - seulement les dernières heures
    const cutoffDate = new Date(Date.now() - 2 * 60 * 60 * 1000) // Dernières 2h seulement
    const { error: cleanupError } = await supabase
      .from('food_logs')
      .delete()
      .gte('timestamp', cutoffDate.toISOString());
    
    if (cleanupError) {
      console.error('❌ Erreur de nettoyage:', cleanupError.message);
      return false;
    }
    
    console.log('✅ Nettoyage sécurisé réussi (dernières 2h seulement) !');
    console.log('');

    console.log('🎉 Tous les tests sont passés !');
    console.log('✅ Votre environnement Supabase de test est prêt !');
    console.log('');
    console.log('📋 Prochaines étapes :');
    console.log('1. Lancer vos tests Playwright : npm run test:e2e');
    console.log('2. Vérifier que les tests passent');
    console.log('3. Commencer à développer vos fonctionnalités !');
    
    return true;
  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
    return false;
  }
}

// Lancer le test
testConnection().then((success) => {
  if (!success) {
    console.error('');
    console.error('🔧 Conseils de dépannage :');
    console.error('1. Vérifiez que votre projet Supabase existe');
    console.error('2. Vérifiez que la table food_logs est créée');
    console.error('3. Vérifiez que les variables d\'environnement sont correctes');
    console.error('4. Vérifiez que RLS est configuré correctement');
    process.exit(1);
  }
});
