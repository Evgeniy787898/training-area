import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://buqjktrypviesnucczjr.supabase.co';
const supabaseKey = 'sb_secret_Ls98mNh34FpF-8ca8qg6yg_sikMhdkd';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigrations() {
  console.log('🚀 Применяю миграции...\n');

  const migrationPath = join(__dirname, 'supabase/migrations/20240101000000_initial_schema.sql');
  const sql = readFileSync(migrationPath, 'utf8');

  // Разбиваем на отдельные команды
  const commands = sql
    .split(';')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

  console.log(`Всего команд: ${commands.length}\n`);

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i] + ';';
    
    // Пропускаем комментарии
    if (command.trim().startsWith('--')) continue;
    
    console.log(`[${i + 1}/${commands.length}] Выполняю...`);
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: command 
      }).catch(async () => {
        // Если rpc не работает, пробуем через прямой запрос
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ sql_query: command })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        return { data: await response.json(), error: null };
      });

      if (error) {
        console.log(`   ⚠️ ${error.message}`);
      } else {
        console.log(`   ✅ Выполнено`);
      }
    } catch (err) {
      console.log(`   ⚠️ ${err.message}`);
    }
  }

  console.log('\n✅ Миграции применены!\n');
  
  // Проверяем таблицы
  console.log('🔍 Проверяю созданные таблицы...\n');
  
  const { data: tables, error: tablesError } = await supabase
    .from('profiles')
    .select('count')
    .limit(0);
  
  if (tablesError) {
    console.log('❌ Ошибка проверки таблиц:', tablesError.message);
    console.log('\n⚠️ Возможно миграции нужно применить вручную.');
    console.log('Откройте: https://supabase.com/dashboard/project/buqjktrypviesnucczjr/sql/new');
    console.log('И выполните SQL из: server/supabase/migrations/20240101000000_initial_schema.sql');
  } else {
    console.log('✅ Таблицы созданы успешно!');
  }
}

applyMigrations().catch(console.error);

