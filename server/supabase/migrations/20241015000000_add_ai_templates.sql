-- AI templates store rule-based responses for internal assistant
create table if not exists ai_templates (
    id uuid primary key default uuid_generate_v4(),
    category text not null,
    tag text not null,
    title text,
    body text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_ai_templates_category_tag
    on ai_templates (category, tag);

-- Seed core greetings (motivational, encouraging, recovery)
insert into ai_templates (category, tag, title, body, metadata) values
('greeting', 'celebration', 'Горячий старт', '🔥 Великолепно держишь темп! Сегодня можно добавить чуть больше техники — тело готово.', '{"tone":"positive","rpe_hint":"держи RPE 7-8","cta":"загляни в план и отмечай каждую победу"}'),
('greeting', 'celebration', 'На волне', '🚀 Видно, что тренировки заходят. Возьми время на короткую разминку и переходи к основному блоку — прогресс тут!', '{"tone":"positive","cta":"запусти тренировку и держи ритм"}'),
('greeting', 'recovery', 'Пауза — часть процесса', '😌 Восстановление тоже работа. Сегодня сфокусируйся на мобилизации и дыхании, чтобы завтра лететь дальше.', '{"tone":"calm","cta":"открой план и выбери мягкую сессию"}'),
('greeting', 'recovery', 'Перезагрузка', '🧘 Тело дало сигнал притормозить — даём ему ресурс. Лёгкая растяжка + сон = новая сила.', '{"tone":"calm","cta":"посмотри раздел «Восстановление» в планере"}'),
('greeting', 'motivation', 'Не сдаёмся', '⚡️ Бывает, что тренировка не зашла. Это не откат, а подсказка. Сегодня цель — вернуться в комфортный ритм и сделать первый шаг.', '{"tone":"motivation","cta":"выбери адаптированную сессию и отметь итог"}'),
('greeting', 'motivation', 'Второе дыхание', '💪 Даже если пропустил, ты всё равно в движении. Составлю мягкий план, чтобы втянуться без перегруза.', '{"tone":"motivation","cta":"запроси облегчённую сессию, я подскажу"}');

-- Seed motivation templates
insert into ai_templates (category, tag, title, body, metadata) values
('motivation', 'streak', 'Серия растёт', '🔥 Серия уже {{current_streak}} тренировки подряд — это отличный фундамент! Зафиксируй ощущения в заметках, чтобы видеть, что помогает держать темп.', '{"threshold":3,"cta":"отметь тренировку в приложении"}'),
('motivation', 'comeback', 'Возврат в ритм', '🔁 Каждый возврат после паузы — инвестиция в привычку. Начнём с базовой сессии, сохраняя RPE в зоне комфорта.', '{"cta":"открой ближайшую тренировку и поставь фокус на технику"}'),
('motivation', 'adherence_low', 'Выдохни и продолжай', '🌱 Низкая регулярность — лишь снимок момента. Сформируем микро-цель на неделю: три коротких тренировки по 25 минут.', '{"cta":"поставь напоминание в приложении"}');

-- Seed plan hints
insert into ai_templates (category, tag, title, body, metadata) values
('plan_hint', 'upcoming_session', 'Следующая тренировка', '📅 Следующая сессия {{weekday}}, {{date_label}}. Фокус: {{focus}}. Поддержи RPE на уровне {{target_rpe}} и зафиксируй обратную связь.', '{"include_schedule":true}'),
('plan_hint', 'rest_day', 'День восстановления', '💤 Сегодня день восстановления. Добавь 10 минут мобилизации — это ускорит прогресс на следующей неделе.', '{"include_recovery":true}');

-- Seed technique feedback
insert into ai_templates (category, tag, title, body, metadata) values
('feedback', 'completed_high', 'Отличный результат', '✅ Выполнено {{completion_rate}}% плана с RPE {{rpe}}. Отличный сигнал, можно добавить усложнение на следующий микроцикл.', '{"strategy":"progression"}'),
('feedback', 'completed_medium', 'Держим баланс', '👍 План закрыт на {{completion_rate}}% с RPE {{rpe}}. Продолжаем в том же духе и отмечаем, какие блоки зашли лучше всего.', '{"strategy":"maintain"}'),
('feedback', 'missed', 'Бывает', '♻️ Тренировка не зашла. Важно понять причину: время, нагрузка или настрой. Сделаем корректировку на ближайшие сессии.', '{"strategy":"adjust"}');
