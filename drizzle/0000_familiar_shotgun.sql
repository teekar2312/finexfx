CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`broker` text DEFAULT 'FINEX Indonesia' NOT NULL,
	`server` text NOT NULL,
	`login` text NOT NULL,
	`user_id` text,
	`currency` text DEFAULT 'USD' NOT NULL,
	`leverage` text DEFAULT '1:100' NOT NULL,
	`balance` real DEFAULT 10000 NOT NULL,
	`equity` real DEFAULT 10000 NOT NULL,
	`margin` real DEFAULT 0 NOT NULL,
	`free_margin` real DEFAULT 10000 NOT NULL,
	`margin_level` real DEFAULT 0 NOT NULL,
	`connected` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `ai_signal_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`signal_id` text NOT NULL,
	`symbol` text NOT NULL,
	`direction` text NOT NULL,
	`action` text NOT NULL,
	`confidence` real NOT NULL,
	`price_at_signal` real NOT NULL,
	`price_at_eval` real NOT NULL,
	`price_change` real NOT NULL,
	`price_change_pct` real NOT NULL,
	`pips_moved` real NOT NULL,
	`correct` integer,
	`evaluated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_signal_outcomes_signal_id_unique` ON `ai_signal_outcomes` (`signal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_signal_outcomes_signal_id_idx` ON `ai_signal_outcomes` (`signal_id`);--> statement-breakpoint
CREATE INDEX `ai_signal_outcomes_symbol_idx` ON `ai_signal_outcomes` (`symbol`);--> statement-breakpoint
CREATE INDEX `ai_signal_outcomes_correct_idx` ON `ai_signal_outcomes` (`correct`);--> statement-breakpoint
CREATE INDEX `ai_signal_outcomes_evaluated_at_idx` ON `ai_signal_outcomes` (`evaluated_at`);--> statement-breakpoint
CREATE TABLE `ai_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`direction` text NOT NULL,
	`confidence` real NOT NULL,
	`timeframe` text DEFAULT 'M5' NOT NULL,
	`reasoning` text NOT NULL,
	`selected_indicators` text NOT NULL,
	`factors` text NOT NULL,
	`action` text DEFAULT 'wait' NOT NULL,
	`model_version` text DEFAULT 'fx-scalper-v1' NOT NULL,
	`accuracy` real DEFAULT 0 NOT NULL,
	`price_at_signal` real,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_signals_symbol_idx` ON `ai_signals` (`symbol`);--> statement-breakpoint
CREATE INDEX `ai_signals_created_at_idx` ON `ai_signals` (`created_at`);--> statement-breakpoint
CREATE INDEX `ai_signals_action_idx` ON `ai_signals` (`action`);--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`condition` text NOT NULL,
	`price` real NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`triggered` integer DEFAULT false NOT NULL,
	`triggered_at` integer,
	`notify_email` integer DEFAULT true NOT NULL,
	`message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alerts_symbol_idx` ON `alerts` (`symbol`);--> statement-breakpoint
CREATE INDEX `alerts_active_idx` ON `alerts` (`active`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`user_email` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`metadata` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_user_id_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `backtests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`timeframe` text DEFAULT 'M5' NOT NULL,
	`strategy` text NOT NULL,
	`period_from` integer NOT NULL,
	`period_to` integer NOT NULL,
	`initial_capital` real NOT NULL,
	`final_capital` real NOT NULL,
	`total_trades` integer NOT NULL,
	`win_trades` integer NOT NULL,
	`loss_trades` integer NOT NULL,
	`win_rate` real NOT NULL,
	`profit_factor` real NOT NULL,
	`max_drawdown` real NOT NULL,
	`sharpe_ratio` real NOT NULL,
	`net_profit` real NOT NULL,
	`equity_curve` text NOT NULL,
	`trades_json` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `backtests_symbol_idx` ON `backtests` (`symbol`);--> statement-breakpoint
CREATE TABLE `economic_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`country` text NOT NULL,
	`currency` text NOT NULL,
	`category` text NOT NULL,
	`impact` text NOT NULL,
	`event_time` integer NOT NULL,
	`actual` text,
	`forecast` text,
	`previous` text,
	`surprise` text,
	`symbols` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`source` text DEFAULT 'marketaux' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `economic_events_event_time_idx` ON `economic_events` (`event_time`);--> statement-breakpoint
CREATE INDEX `economic_events_impact_idx` ON `economic_events` (`impact`);--> statement-breakpoint
CREATE INDEX `economic_events_category_idx` ON `economic_events` (`category`);--> statement-breakpoint
CREATE INDEX `economic_events_country_idx` ON `economic_events` (`country`);--> statement-breakpoint
CREATE TABLE `indicators` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`default_params` text NOT NULL,
	`scalping_preset` text,
	`enabled` integer DEFAULT true NOT NULL,
	`auto_managed` integer DEFAULT false NOT NULL,
	`weight` real DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `indicators_name_unique` ON `indicators` (`name`);--> statement-breakpoint
CREATE TABLE `logs` (
	`id` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`source` text DEFAULT 'system' NOT NULL,
	`message` text NOT NULL,
	`stack` text,
	`context` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `logs_level_idx` ON `logs` (`level`);--> statement-breakpoint
CREATE INDEX `logs_source_idx` ON `logs` (`source`);--> statement-breakpoint
CREATE INDEX `logs_created_at_idx` ON `logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`value` real NOT NULL,
	`tags` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `metrics_name_idx` ON `metrics` (`name`);--> statement-breakpoint
CREATE INDEX `metrics_created_at_idx` ON `metrics` (`created_at`);--> statement-breakpoint
CREATE TABLE `news_items` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`url` text,
	`category` text NOT NULL,
	`impact` text DEFAULT 'medium' NOT NULL,
	`sentiment` text DEFAULT 'neutral' NOT NULL,
	`symbols` text DEFAULT '' NOT NULL,
	`published_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `news_items_category_idx` ON `news_items` (`category`);--> statement-breakpoint
CREATE INDEX `news_items_impact_idx` ON `news_items` (`impact`);--> statement-breakpoint
CREATE INDEX `news_items_published_at_idx` ON `news_items` (`published_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`recipient` text NOT NULL,
	`sent` integer DEFAULT false NOT NULL,
	`sent_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_type_idx` ON `notifications` (`type`);--> statement-breakpoint
CREATE INDEX `notifications_created_at_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`symbol` text NOT NULL,
	`side` text NOT NULL,
	`order_type` text NOT NULL,
	`lot_size` real NOT NULL,
	`price` real NOT NULL,
	`stop_loss` real,
	`take_profit` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`open_time` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `orders_account_id_idx` ON `orders` (`account_id`);--> statement-breakpoint
CREATE TABLE `risk_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `risk_settings_key_unique` ON `risk_settings` (`key`);--> statement-breakpoint
CREATE TABLE `system_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_configs_key_unique` ON `system_configs` (`key`);--> statement-breakpoint
CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`symbol` text NOT NULL,
	`side` text NOT NULL,
	`lot_size` real NOT NULL,
	`open_price` real NOT NULL,
	`close_price` real,
	`stop_loss` real,
	`take_profit` real,
	`trailing_stop` integer DEFAULT false NOT NULL,
	`trailing_pips` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`pnl` real DEFAULT 0 NOT NULL,
	`pips` real DEFAULT 0 NOT NULL,
	`commission` real DEFAULT 0 NOT NULL,
	`swap` real DEFAULT 0 NOT NULL,
	`strategy` text DEFAULT 'scalping-m5' NOT NULL,
	`timeframe` text DEFAULT 'M5' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`comment` text,
	`mt5_ticket` integer,
	`mt5_server` text,
	`slippage_pips` real,
	`execution_latency_ms` integer,
	`open_time` integer NOT NULL,
	`close_time` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trades_account_id_idx` ON `trades` (`account_id`);--> statement-breakpoint
CREATE INDEX `trades_symbol_idx` ON `trades` (`symbol`);--> statement-breakpoint
CREATE INDEX `trades_status_idx` ON `trades` (`status`);--> statement-breakpoint
CREATE INDEX `trades_mt5_ticket_idx` ON `trades` (`mt5_ticket`);--> statement-breakpoint
CREATE INDEX `trades_account_status_opentime_idx` ON `trades` (`account_id`,`status`,`open_time`);--> statement-breakpoint
CREATE INDEX `trades_status_closetime_idx` ON `trades` (`status`,`close_time`);--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_session_token_unique` ON `user_sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `user_sessions_user_id_idx` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_sessions_expires_at_idx` ON `user_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'trader' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);