const fs = require('fs');
const path = require('path');

const functionsFile = '/Users/arturo/Documents/Github/MACOM/worklenz/worklenz-backend/database/sql/4_functions.sql';
let functionsSql = fs.readFileSync(functionsFile, 'utf8');

const migrationsFile = '/Users/arturo/Documents/Github/MACOM/worklenz/worklenz-backend/database/migrations/consolidated-progress-migrations.sql';
const migrationsSql = fs.readFileSync(migrationsFile, 'utf8');

function extractFunction(name, sourceSql, occurrence = 1) {
    const regex = new RegExp(`CREATE OR REPLACE FUNCTION ${name}[\\s\\S]*?\\$\\$;`, 'g');
    let match;
    let count = 0;
    while ((match = regex.exec(sourceSql)) !== null) {
        count++;
        if (count === occurrence) {
            return match[0];
        }
    }
    const publicRegex = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}[\\s\\S]*?\\$\\$;`, 'g');
    count = 0;
    while ((match = publicRegex.exec(sourceSql)) !== null) {
        count++;
        if (count === occurrence) {
            return match[0];
        }
    }
    return null;
}

function replaceFunction(name, newBody) {
    const regex = new RegExp(`CREATE OR REPLACE FUNCTION ${name}[\\s\\S]*?\\$\\$;`, 'g');
    if (regex.test(functionsSql)) {
        functionsSql = functionsSql.replace(regex, newBody);
        console.log(`Replaced ${name} in 4_functions.sql`);
    } else {
        functionsSql += '\\n\\n' + newBody;
        console.log(`Appended ${name} to 4_functions.sql`);
    }
}

// 1. get_task_complete_ratio (latest is 2nd occurrence in migrations file?)
let getTaskCompleteRatio = extractFunction('get_task_complete_ratio', migrationsSql, 2);
if (!getTaskCompleteRatio) getTaskCompleteRatio = extractFunction('get_task_complete_ratio', migrationsSql, 1);
replaceFunction('get_task_complete_ratio', getTaskCompleteRatio);

// 2. update_project
const updateProject = extractFunction('update_project', migrationsSql, 1);
replaceFunction('update_project', updateProject);

// 3. create_project
const createProject = extractFunction('create_project', migrationsSql, 1);
replaceFunction('create_project', createProject);

// 4. get_task_form_view_model
const getTaskFormVM = extractFunction('get_task_form_view_model', migrationsSql, 1);
replaceFunction('get_task_form_view_model', getTaskFormVM.replace('public.', ''));

// append others
['on_update_task_progress', 'on_update_task_weight', 'reset_project_progress_values', 'reset_progress_on_mode_change'].forEach(fn => {
    const fnBody = extractFunction(fn, migrationsSql, 1);
    const regex = new RegExp(`CREATE OR REPLACE FUNCTION ${fn}[\\s\\S]*?\\$\\$;`, 'g');
    if (!regex.test(functionsSql) && fnBody) {
        functionsSql += '\\n\\n' + fnBody;
        console.log(`Appended ${fn} to 4_functions.sql`);
    }
});

fs.writeFileSync(functionsFile, functionsSql, 'utf8');

// Now check 20250424000000-add-progress-and-weight-activity-types.sql
const activityLogMigFile = '/Users/arturo/Documents/Github/MACOM/worklenz/worklenz-backend/database/migrations/20250424000000-add-progress-and-weight-activity-types.sql';
const activityLogMigSql = fs.readFileSync(activityLogMigFile, 'utf8');
const getActivityLogs = extractFunction('get_activity_logs_by_task', activityLogMigSql, 1);
if (getActivityLogs) {
    replaceFunction('get_activity_logs_by_task', getActivityLogs);
    fs.writeFileSync(functionsFile, functionsSql, 'utf8');
}

// Also let's update triggers.sql
const triggersFile = '/Users/arturo/Documents/Github/MACOM/worklenz/worklenz-backend/database/sql/triggers.sql';
let triggersSql = fs.readFileSync(triggersFile, 'utf8');
if (!triggersSql.includes('trg_reset_progress_on_mode_change')) {
    triggersSql += '\\n\\nDROP TRIGGER IF EXISTS trg_reset_progress_on_mode_change ON projects;\\nCREATE TRIGGER trg_reset_progress_on_mode_change\\n    BEFORE UPDATE\\n    ON projects\\n    FOR EACH ROW\\n    WHEN (OLD.use_manual_progress IS DISTINCT FROM NEW.use_manual_progress OR\\n          OLD.use_weighted_progress IS DISTINCT FROM NEW.use_weighted_progress OR\\n          OLD.use_time_progress IS DISTINCT FROM NEW.use_time_progress)\\nEXECUTE FUNCTION reset_progress_on_mode_change();';
    fs.writeFileSync(triggersFile, triggersSql, 'utf8');
    console.log('Appended trigger to triggers.sql');
}

console.log('Done patching SQL files!');
