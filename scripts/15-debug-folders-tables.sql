-- Debug script to check folders tables
SELECT 'folders table count:' as info, COUNT(*) as count FROM folders;
SELECT 'template_folders table count:' as info, COUNT(*) as count FROM template_folders;

-- Show sample data from both tables
SELECT 'folders sample:' as info, id, name, user_id FROM folders LIMIT 5;
SELECT 'template_folders sample:' as info, id, name, user_id FROM template_folders LIMIT 5;

-- Check if we need to migrate data
SELECT 'folders with data:' as info, COUNT(*) as count FROM folders WHERE name IS NOT NULL;
SELECT 'template_folders with data:' as info, COUNT(*) as count FROM template_folders WHERE name IS NOT NULL;
