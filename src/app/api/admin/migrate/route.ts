import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// POST /api/admin/migrate — idempotent. Run once (or re-run safely).
export async function POST() {
  // ── Drop obsolete basket tables (replaced by cart/order system) ──
  await query(`DROP TABLE IF EXISTS basket_items CASCADE`);
  await query(`DROP TABLE IF EXISTS med_baskets  CASCADE`);

  // ── medications_catalog ── (price in IQD, available for all patients)
  await query(`
    CREATE TABLE IF NOT EXISTS medications_catalog (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      form        TEXT,
      strength    TEXT,
      price       NUMERIC(10,2),
      description TEXT,
      available   BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);

  type CatalogRow = [string, string, string, number, string];
  const catalog: CatalogRow[] = [
    ['Metformin',        'Tablet',    '500 mg',        3500,  'Type 2 diabetes management'],
    ['Insulin Glargine', 'Injection', '100 IU/mL',    35000,  'Long-acting insulin for diabetes'],
    ['Insulin Regular',  'Injection', '100 IU/mL',    25000,  'Short-acting insulin for diabetes'],
    ['Lisinopril',       'Tablet',    '10 mg',         4500,  'ACE inhibitor for hypertension'],
    ['Amlodipine',       'Tablet',    '5 mg',          3500,  'Calcium channel blocker for hypertension'],
    ['Atorvastatin',     'Tablet',    '20 mg',         8000,  'Statin for high cholesterol'],
    ['Aspirin',          'Tablet',    '100 mg',        2000,  'Antiplatelet for cardiovascular protection'],
    ['Furosemide',       'Tablet',    '40 mg',         3000,  'Loop diuretic for heart failure / oedema'],
    ['Carvedilol',       'Tablet',    '25 mg',         7500,  'Beta-blocker for heart failure'],
    ['Bisoprolol',       'Tablet',    '5 mg',          6000,  'Beta-blocker for heart failure / hypertension'],
    ['Metoprolol',       'Tablet',    '50 mg',         5500,  'Beta-blocker for hypertension / angina'],
    ['Salbutamol',       'Inhaler',   '100 mcg/dose',  8500,  'Short-acting bronchodilator for asthma'],
    ['Budesonide',       'Inhaler',   '200 mcg/dose', 15000,  'Inhaled corticosteroid for asthma'],
    ['Omeprazole',       'Capsule',   '20 mg',         4500,  'Proton pump inhibitor for acid reflux'],
    ['Paracetamol',      'Tablet',    '500 mg',        2500,  'Analgesic / antipyretic'],
    ['Amoxicillin',      'Capsule',   '500 mg',        5000,  'Broad-spectrum antibiotic'],
    ['Levothyroxine',    'Tablet',    '50 mcg',        5500,  'Thyroid hormone replacement'],
    ['Warfarin',         'Tablet',    '5 mg',          4000,  'Anticoagulant'],
    ['Losartan',         'Tablet',    '50 mg',         6500,  'ARB for hypertension'],
    ['Ramipril',         'Tablet',    '5 mg',          5000,  'ACE inhibitor for hypertension / heart failure'],
    ['Spironolactone',   'Tablet',    '25 mg',         4500,  'Potassium-sparing diuretic for heart failure'],
    ['Glibenclamide',    'Tablet',    '5 mg',          3000,  'Sulfonylurea for type 2 diabetes'],
    ['Sitagliptin',      'Tablet',    '100 mg',       18000,  'DPP-4 inhibitor for type 2 diabetes'],
    ['Rosuvastatin',     'Tablet',    '10 mg',         9000,  'Statin for high cholesterol'],
    ['Allopurinol',      'Tablet',    '300 mg',        4000,  'Xanthine oxidase inhibitor for gout'],
    ['Codeine',          'Tablet',    '30 mg',         6000,  'Opioid analgesic'],
    ['Prednisolone',     'Tablet',    '5 mg',          3500,  'Corticosteroid for inflammation'],
    ['Azithromycin',     'Tablet',    '500 mg',        9000,  'Macrolide antibiotic'],
    ['Cetirizine',       'Tablet',    '10 mg',         2500,  'Antihistamine for allergies'],
    ['Ibuprofen',        'Tablet',    '400 mg',        3000,  'NSAID analgesic / anti-inflammatory'],
  ];

  for (const [name, form, strength, price, description] of catalog) {
    await query(
      `INSERT INTO medications_catalog (name, form, strength, price, description, available)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (name) DO UPDATE
         SET form = EXCLUDED.form, strength = EXCLUDED.strength,
             price = EXCLUDED.price, description = EXCLUDED.description`,
      [name, form, strength, price, description],
    );
  }

  // ── carts: one open cart per patient ──
  await query(`
    CREATE TABLE IF NOT EXISTS carts (
      id         SERIAL PRIMARY KEY,
      patient_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status     TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'submitted'))
    )
  `);

  // ── cart_items: individual medication lines ──
  await query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id             SERIAL PRIMARY KEY,
      cart_id        INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      medication_id  TEXT NOT NULL,
      name_snapshot  TEXT NOT NULL,
      quantity       INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      group_id       TEXT,
      group_name     TEXT,
      price_snapshot NUMERIC(10,2),
      UNIQUE(cart_id, medication_id)
    )
  `);
  await query(`ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS price_snapshot NUMERIC(10,2)`);

  // ── orders: submitted (recorded) orders ──
  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id         SERIAL PRIMARY KEY,
      patient_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status     TEXT NOT NULL DEFAULT 'recorded',
      total      NUMERIC(10,2)
    )
  `);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS total NUMERIC(10,2)`);

  // ── order_items: immutable snapshot of what was ordered ──
  await query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id                  SERIAL PRIMARY KEY,
      order_id            INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      medication_id       TEXT NOT NULL,
      name_snapshot       TEXT NOT NULL,
      quantity            INTEGER NOT NULL,
      group_name_snapshot TEXT,
      price_snapshot      NUMERIC(10,2)
    )
  `);
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price_snapshot NUMERIC(10,2)`);

  // ── chronic_disease_content ──
  await query(`
    CREATE TABLE IF NOT EXISTS chronic_disease_content (
      id             SERIAL PRIMARY KEY,
      condition_code TEXT NOT NULL,
      condition_key  TEXT NOT NULL,
      language       TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','ar','ku')),
      category       TEXT,
      title          TEXT NOT NULL,
      body_text      TEXT NOT NULL,
      sort_order     INTEGER NOT NULL DEFAULT 0
    )
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS cdc_uix
    ON chronic_disease_content (condition_code, language, sort_order)
  `).catch(() => {});

  type SeedRow = [string, string, string, string | null, string, string, number];
  const seed: SeedRow[] = [
    ['E11','diabetes','en','diet','Watch what you eat','Limit refined carbohydrates such as white bread, rice, and sugary drinks. Favour vegetables, whole grains, and lean protein.',1],
    ['E11','diabetes','en','monitoring','Check your blood sugar regularly','Regular blood glucose monitoring helps you and your doctor spot patterns early. Keep a log of your readings.',2],
    ['E11','diabetes','en','exercise','Move every day','Aim for at least 30 minutes of moderate activity on most days. Physical activity helps your body use insulin more effectively.',3],
    ['E11','diabetes','ar','diet','راقب ما تأكله','تجنب الكربوهيدرات المكررة كالخبز الأبيض والأرز والمشروبات السكرية. آثر الخضراوات والحبوب الكاملة والبروتين الخالي من الدهون.',1],
    ['E11','diabetes','ar','monitoring','راقب مستوى السكر في دمك بانتظام','تساعدك المتابعة المنتظمة لمستوى الجلوكوز على اكتشاف الأنماط مبكراً. احتفظ بسجل لقراءاتك.',2],
    ['E11','diabetes','ar','exercise','تحرك كل يوم','اهدف إلى ممارسة نشاط بدني معتدل لا يقل عن 30 دقيقة يومياً. يساعد النشاط البدني جسمك على استخدام الأنسولين بفاعلية أكبر.',3],
    ['E11','diabetes','ku','diet','سەیری خواردنەکەت بکە','کاربۆهایدرەیتی پاڵاوراو وەک نانی سپی، برنج، و خواردنی شەکردار کەم بکەوە.',1],
    ['E11','diabetes','ku','monitoring','شەکری خوێنەکەت بە بەردەوامی پشکنین بکە','پشکنینی بەردەوامی گلوکۆز یارمەتیدەدات کە نموونەکان زوو دەردەکەون.',2],
    ['E11','diabetes','ku','exercise','ڕۆژانە بجووڵە','دواچوونی 30 خولەکی ئاستەواز مانەوە وەک پێپیاوکردنی خێرا ئامانج بگرە.',3],
    ['I10','hypertension','en','diet','Cut down on salt','Aim for less than 5 g of salt per day. A diet rich in fruits, vegetables, and low-fat dairy is proven to lower blood pressure.',1],
    ['I10','hypertension','en','monitoring','Measure your blood pressure at home','Take two readings in the morning before medication and two in the evening for seven days. Target is below 130/80 mmHg.',2],
    ['I10','hypertension','en','lifestyle','Manage stress','Chronic stress raises blood pressure. Try short daily walks, deep-breathing exercises, or other relaxation techniques.',3],
    ['I10','hypertension','ar','diet','قلل تناول الملح','اهدف إلى أقل من 5 غرامات من الملح يومياً. النظام الغذائي الغني بالفواكه والخضراوات ثبتت فاعليته في خفض ضغط الدم.',1],
    ['I10','hypertension','ar','monitoring','راقب ضغط دمك في المنزل','خذ قراءتين صباحاً قبل تناول الدواء وقراءتين مساءً لمدة سبعة أيام. الهدف الطبيعي أقل من 130/80.',2],
    ['I10','hypertension','ar','lifestyle','تحكم في التوتر','التوتر المزمن يرفع ضغط الدم. جرب تمارين التنفس العميق أو المشي اليومي القصير.',3],
    ['I10','hypertension','ku','diet','خوێ کەم بخۆ','ئامانج بگرە کەمتر لە 5 گرام خوێ ڕۆژانە. خواردنی دەوڵەمەند لە میوە و سەوزە کاریگەری ئامادەکراویەتی بۆ دابەزاندنی تانسیۆن.',1],
    ['I10','hypertension','ku','monitoring','تانسیۆنەکەت لە ماڵ پشکنین بکە','دوو قراءت بەیانیان پێش دەرمان و دوو ئێواران لە ماوەی حەوت ڕۆژ بگرە. ئامانج کەمتر لە 130/80.',2],
    ['I10','hypertension','ku','lifestyle','ستریسەکانت بیکوژێنەرەوە','ستریسی بەردەوام تانسیۆن بەرز دەکاتەوە. شێوازی هەناسەگرتنی قووڵ یان پێپیاوکردنی ڕۆژانەی کورت تاقیبکەرەوە.',3],
    ['J45','asthma','en','monitoring','Know your triggers','Common asthma triggers include dust mites, pollen, pet dander, cold air, and tobacco smoke. Identify and reduce exposure.',1],
    ['J45','asthma','en','medication','Keep your rescue inhaler accessible','Always carry your short-acting reliever inhaler. If you need it more than twice a week, contact your doctor.',2],
    ['J45','asthma','ar','monitoring','تعرف على محفزات ربوك','تشمل محفزات الربو الشائعة عث الغبار والحبوب ووبر الحيوانات الأليفة والهواء البارد. حدد محفزاتك وقلل التعرض.',1],
    ['J45','asthma','ar','medication','احتفظ ببخاخ الإنقاذ دائماً معك','احمل دائماً بخاخ الإسعاف سريع المفعول. إذا احتجت إليه أكثر من مرتين في الأسبوع، راجع طبيبك.',2],
    ['J45','asthma','ku','monitoring','هۆکارەکانی ئەستمات بناسە','هۆکارە باوەکانی ئەستما تووزی مەلمەلێک، گەردە، موی ئاژەڵی ماڵ، و ئاوای سارد دەگرێتەوە.',1],
    ['J45','asthma','ku','medication','بەخشێنەرەکەت لەگەڵت بێت','هەمیشە بەخشێنەرەکەی خێراکاردەکاتی خۆت لەگەڵت بگرە. ئەگەر زیاتر لە دووجار لە هەفتەیەکدا پێویستت کرد پزیشک بئاگادار بکەرەوە.',2],
    ['E78','cholesterol','en','diet','Eat a heart-healthy diet','Replace saturated fats with unsaturated fats found in olive oil, nuts, and oily fish. Increase soluble fibre from oats and beans.',1],
    ['E78','cholesterol','ar','diet','اتبع نظاماً غذائياً صديقاً للقلب','استبدل الدهون المشبعة بالدهون غير المشبعة الموجودة في زيت الزيتون والمكسرات والأسماك. زد تناول الألياف القابلة للذوبان.',1],
    ['E78','cholesterol','ku','diet','خواردنی دڵپاکانە بۆ قەڵب','چەوری دۆشاوراو جێگری چەوری نادۆشاوراو لە زەیتوونی، قۆز، و ماسیی چەوردار بکە.',1],
    ['N18','kidney','en','diet','Protect your kidneys through diet','Limit potassium-rich and phosphorus-rich foods as instructed by your care team. Ask your doctor for your daily fluid target.',1],
    ['N18','kidney','ar','diet','احمِ كليتيك من خلال التغذية','قلل الأطعمة الغنية بالبوتاسيوم والفوسفور وفق توجيهات فريق رعايتك. استشر طبيبك حول الكمية المناسبة من السوائل.',1],
    ['N18','kidney','ku','diet','گورچیلەکانت بەڕێی خواردن بپارێزە','خواردنی دەوڵەمەند لە پۆتاسیۆم و فۆسفۆر کەم بکەوە بەپێی ڕێنمایی تیمی تیمارتان.',1],
  ];

  for (const [code, key, lang, cat, title, body, order] of seed) {
    await query(
      `INSERT INTO chronic_disease_content
         (condition_code, condition_key, language, category, title, body_text, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (condition_code, language, sort_order) DO NOTHING`,
      [code, key, lang, cat, title, body, order],
    );
  }

  return NextResponse.json({ ok: true, message: 'Migration complete.' });
}
