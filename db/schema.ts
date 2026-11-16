import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const cmsState=sqliteTable('cms_state',{
 id:text('id').primaryKey(),revision:integer('revision').notNull(),content:text('content').notNull(),
 updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),changeId:text('change_id').notNull(),
});
export const cmsHistory=sqliteTable('cms_history',{
 revision:integer('revision').primaryKey(),content:text('content').notNull(),updatedAt:text('updated_at').notNull(),
 updatedBy:text('updated_by').notNull(),operation:text('operation').notNull(),
});
