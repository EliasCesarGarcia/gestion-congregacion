import { createClient } from '@supabase/supabase-js';

// Leemos las variables desde el archivo .env automáticamente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY; 

// Creamos el cliente usando las variables seguras
export const supabase = createClient(supabaseUrl, supabaseAnonKey);