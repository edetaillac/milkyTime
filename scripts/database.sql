-- Script pour ajouter la colonne user_id à la table food_logs
-- Ce script doit être exécuté dans votre base de données Supabase

-- Ajouter la colonne user_id à la table food_logs
ALTER TABLE public.food_logs 
ADD COLUMN user_id uuid;

-- Créer un index sur user_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_food_logs_user_id 
ON public.food_logs USING btree (user_id);

-- Optionnel : Ajouter une contrainte de clé étrangère si vous avez une table users
-- ALTER TABLE public.food_logs 
-- ADD CONSTRAINT fk_food_logs_user_id 
-- FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Mettre à jour les logs existants avec l'ID utilisateur par défaut
UPDATE public.food_logs 
SET user_id = '550e8400-e29b-41d4-a716-446655440001'::uuid 
WHERE user_id IS NULL;

-- Rendre la colonne user_id obligatoire (à faire après avoir mis à jour les données existantes)
-- ALTER TABLE public.food_logs 
-- ALTER COLUMN user_id SET NOT NULL;
