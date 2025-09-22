#!/bin/bash
# Script d'initialisation de l'environnement de test sécurisé

set -e  # Arrêter en cas d'erreur

echo "🔧 Initialisation de l'environnement de test sécurisé..."
echo ""

# 1. Vérifier si .env.test existe déjà
if [ -f ".env.test" ]; then
    echo "⚠️  Le fichier .env.test existe déjà."
    read -p "Voulez-vous le remplacer ? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Opération annulée."
        exit 0
    fi
fi

# 2. Copier le template
echo "📋 Copie du template de configuration..."
if [ ! -f "env.test.example" ]; then
    echo "❌ ERREUR: Le fichier env.test.example n'existe pas !"
    exit 1
fi

cp env.test.example .env.test
echo "✅ Fichier .env.test créé"

# 3. Instructions pour l'utilisateur
echo ""
echo "🚨 CONFIGURATION OBLIGATOIRE :"
echo ""
echo "1. Aller sur https://supabase.com"
echo "2. Créer un NOUVEAU projet appelé 'milkytime-test'"
echo "3. Noter l'URL et la clé anonyme du projet de test"
echo "4. Éditer le fichier .env.test :"
echo "   - Remplacer NEXT_PUBLIC_SUPABASE_URL"
echo "   - Remplacer NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo ""
echo "⚠️  IMPORTANT: N'utilisez JAMAIS les identifiants de production !"
echo ""

# 4. Ouvrir le fichier pour édition (si possible)
if command -v code &> /dev/null; then
    read -p "Ouvrir .env.test dans VS Code maintenant ? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        code .env.test
    fi
elif command -v nano &> /dev/null; then
    read -p "Ouvrir .env.test dans nano maintenant ? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        nano .env.test
    fi
fi

# 5. Instructions finales
echo ""
echo "🎯 PROCHAINES ÉTAPES :"
echo ""
echo "1. Modifier .env.test avec vos vraies valeurs de test"
echo "2. Vérifier la configuration : npm run test:verify-config"
echo "3. Tester la connexion : npm run test:setup"
echo "4. Lancer les tests : npm run test:all"
echo ""
echo "🛡️  Vos tests ne pourront PAS s'exécuter tant que"
echo "    vous n'aurez pas configuré une vraie base de test !"
