const { exec } = require('./db');

function createTables() {
  exec(`
    -- CORE USER & AUTH TABLES
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      full_name TEXT,
      phone TEXT,
      avatar TEXT,
      date_of_birth TEXT,
      gender TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      medical_info TEXT,
      fitness_goals TEXT,
      height REAL,
      weight REAL,
      fitness_level TEXT DEFAULT 'beginner',
      preferred_workout_time TEXT,
      email_verified INTEGER DEFAULT 0,
      phone_verified INTEGER DEFAULT 0,
      two_factor_enabled INTEGER DEFAULT 0,
      two_factor_secret TEXT,
      is_active INTEGER DEFAULT 1,
      last_login TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      is_system INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      module TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      FOREIGN KEY (role_id) REFERENCES roles(id),
      FOREIGN KEY (permission_id) REFERENCES permissions(id)
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      branch_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- BRANCH TABLE
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      phone TEXT,
      email TEXT,
      manager_id INTEGER,
      opening_hours TEXT DEFAULT '{}',
      map_embed_url TEXT,
      facilities TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- EMPLOYEE / STAFF TABLES
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      employee_id TEXT UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      department TEXT,
      designation TEXT,
      branch_id INTEGER,
      manager_id INTEGER,
      joining_date TEXT,
      salary REAL DEFAULT 0,
      salary_type TEXT DEFAULT 'monthly',
      bank_account TEXT,
      ifsc_code TEXT,
      pan_number TEXT,
      aadhar_number TEXT,
      documents TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (branch_id) REFERENCES branches(id)
    );

    CREATE TABLE IF NOT EXISTS employee_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      working_hours REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      status TEXT DEFAULT 'present',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days INTEGER DEFAULT 1,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      approved_by INTEGER,
      approved_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      basic_salary REAL DEFAULT 0,
      allowances REAL DEFAULT 0,
      deductions REAL DEFAULT 0,
      incentives REAL DEFAULT 0,
      overtime_pay REAL DEFAULT 0,
      advances REAL DEFAULT 0,
      net_salary REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      paid_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    -- MEMBERSHIP TABLES
    CREATE TABLE IF NOT EXISTS membership_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      original_price REAL,
      duration_months INTEGER NOT NULL,
      features TEXT DEFAULT '[]',
      gym_access INTEGER DEFAULT 1,
      class_access INTEGER DEFAULT 0,
      pt_sessions INTEGER DEFAULT 0,
      sauna_access INTEGER DEFAULT 0,
      locker_included INTEGER DEFAULT 0,
      guest_passes INTEGER DEFAULT 0,
      nutrition_consultation INTEGER DEFAULT 0,
      freeze_days INTEGER DEFAULT 0,
      branch_access TEXT DEFAULT 'all',
      terms_conditions TEXT,
      is_popular INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      membership_id TEXT UNIQUE,
      user_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      branch_id INTEGER,
      status TEXT DEFAULT 'active',
      start_date TEXT,
      end_date TEXT,
      original_end_date TEXT,
      freeze_date TEXT,
      freeze_reason TEXT,
      assigned_salesperson INTEGER,
      assigned_trainer INTEGER,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      final_amount REAL DEFAULT 0,
      payment_method TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (plan_id) REFERENCES membership_plans(id)
    );

    -- ATTENDANCE TABLE
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      branch_id INTEGER,
      check_in TEXT NOT NULL,
      check_out TEXT,
      duration_minutes INTEGER DEFAULT 0,
      entry_method TEXT DEFAULT 'manual',
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- CLASS & BOOKING TABLES
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      trainer_id INTEGER,
      branch_id INTEGER,
      duration_minutes INTEGER DEFAULT 60,
      difficulty TEXT DEFAULT 'intermediate',
      category TEXT,
      max_participants INTEGER DEFAULT 20,
      room TEXT,
      image TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trainer_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS class_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT DEFAULT 'Main Studio',
      specific_date TEXT,
      status TEXT DEFAULT 'scheduled',
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );

    CREATE TABLE IF NOT EXISTS class_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      schedule_id INTEGER,
      user_id INTEGER NOT NULL,
      booking_date TEXT NOT NULL,
      status TEXT DEFAULT 'booked',
      check_in INTEGER DEFAULT 0,
      cancelled_at TEXT,
      cancel_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS class_waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      schedule_id INTEGER,
      user_id INTEGER NOT NULL,
      position INTEGER DEFAULT 1,
      status TEXT DEFAULT 'waiting',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- PERSONAL TRAINING TABLES
    CREATE TABLE IF NOT EXISTS pt_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sessions INTEGER NOT NULL,
      price REAL NOT NULL,
      duration_days INTEGER DEFAULT 30,
      description TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pt_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      trainer_id INTEGER NOT NULL,
      package_id INTEGER,
      sessions_total INTEGER DEFAULT 0,
      sessions_completed INTEGER DEFAULT 0,
      sessions_remaining INTEGER DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (trainer_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS pt_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      trainer_id INTEGER NOT NULL,
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT,
      duration_minutes INTEGER DEFAULT 60,
      status TEXT DEFAULT 'scheduled',
      notes TEXT,
      trainer_notes TEXT,
      rating INTEGER,
      feedback TEXT,
      completed_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES pt_assignments(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (trainer_id) REFERENCES employees(id)
    );

    -- WORKOUT MANAGEMENT TABLES
    CREATE TABLE IF NOT EXISTS workout_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      trainer_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      duration_weeks INTEGER DEFAULT 4,
      difficulty TEXT DEFAULT 'intermediate',
      goal TEXT,
      is_template INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS workout_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      day_number INTEGER NOT NULL,
      day_name TEXT NOT NULL,
      focus TEXT,
      notes TEXT,
      FOREIGN KEY (plan_id) REFERENCES workout_plans(id)
    );

    CREATE TABLE IF NOT EXISTS workout_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      sets INTEGER DEFAULT 3,
      reps TEXT DEFAULT '10',
      weight TEXT DEFAULT '',
      rest_seconds INTEGER DEFAULT 60,
      tempo TEXT DEFAULT '',
      notes TEXT,
      video_url TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (day_id) REFERENCES workout_days(id)
    );

    CREATE TABLE IF NOT EXISTS exercise_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      muscle_group TEXT,
      equipment TEXT,
      difficulty TEXT DEFAULT 'intermediate',
      description TEXT,
      video_url TEXT,
      image TEXT,
      instructions TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id INTEGER,
      exercise_name TEXT,
      sets_completed INTEGER,
      reps_completed TEXT,
      weight_used TEXT,
      notes TEXT,
      logged_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- DIET / NUTRITION TABLES
    CREATE TABLE IF NOT EXISTS diet_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      nutritionist_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      total_calories INTEGER DEFAULT 2000,
      protein_grams INTEGER DEFAULT 150,
      carbs_grams INTEGER DEFAULT 200,
      fats_grams INTEGER DEFAULT 70,
      meals TEXT DEFAULT '[]',
      supplements TEXT DEFAULT '[]',
      water_intake_ml INTEGER DEFAULT 3000,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      start_date TEXT,
      end_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS diet_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      diet_plan_id INTEGER,
      meal_type TEXT,
      food_item TEXT,
      calories INTEGER DEFAULT 0,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fats REAL DEFAULT 0,
      logged_date TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS water_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount_ml INTEGER DEFAULT 500,
      logged_date TEXT NOT NULL,
      logged_time TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- BODY MEASUREMENTS & PROGRESS
    CREATE TABLE IF NOT EXISTS body_measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      weight REAL,
      height REAL,
      bmi REAL,
      body_fat REAL,
      chest REAL,
      waist REAL,
      arms REAL,
      thighs REAL,
      hips REAL,
      shoulders REAL,
      neck REAL,
      calves REAL,
      notes TEXT,
      measured_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS progress_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      photo_url TEXT NOT NULL,
      photo_type TEXT DEFAULT 'front',
      weight REAL,
      notes TEXT,
      photo_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- CRM / LEADS TABLES
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id TEXT UNIQUE,
      source TEXT DEFAULT 'website',
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      age INTEGER,
      gender TEXT,
      fitness_goal TEXT,
      interested_plan TEXT,
      interested_program TEXT,
      preferred_branch INTEGER,
      preferred_date TEXT,
      preferred_time TEXT,
      assigned_salesperson INTEGER,
      lead_score INTEGER DEFAULT 0,
      status TEXT DEFAULT 'NEW_LEAD',
      next_followup_date TEXT,
      next_followup_time TEXT,
      trial_date TEXT,
      trial_attended INTEGER DEFAULT 0,
      conversion_date TEXT,
      lost_reason TEXT,
      message TEXT,
      notes TEXT,
      tags TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (preferred_branch) REFERENCES branches(id)
    );

    CREATE TABLE IF NOT EXISTS lead_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      user_id INTEGER,
      activity_type TEXT NOT NULL,
      description TEXT,
      outcome TEXT,
      scheduled_date TEXT,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );

    CREATE TABLE IF NOT EXISTS lead_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      admin_id INTEGER,
      followup_type TEXT DEFAULT 'call',
      note TEXT,
      outcome TEXT,
      next_followup_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );

    -- TRAINERS (display/public facing - links to employees)
    CREATE TABLE IF NOT EXISTS trainers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      photo TEXT,
      designation TEXT,
      experience_years INTEGER DEFAULT 0,
      certifications TEXT DEFAULT '[]',
      specializations TEXT DEFAULT '[]',
      bio TEXT,
      social_links TEXT DEFAULT '{}',
      rating REAL DEFAULT 0,
      total_members INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );

    -- FACILITIES
    CREATE TABLE IF NOT EXISTS facilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      image TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );

    -- GALLERY
    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      image TEXT NOT NULL,
      category TEXT DEFAULT 'gym',
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    -- TESTIMONIALS
    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      photo TEXT,
      rating INTEGER DEFAULT 5,
      testimonial TEXT NOT NULL,
      date TEXT,
      is_approved INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    -- TRANSFORMATIONS
    CREATE TABLE IF NOT EXISTS transformations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      before_image TEXT,
      after_image TEXT,
      duration TEXT,
      start_weight TEXT,
      end_weight TEXT,
      story TEXT,
      training_approach TEXT,
      testimonial TEXT,
      is_active INTEGER DEFAULT 1
    );

    -- OFFERS & COUPONS
    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      offer_type TEXT DEFAULT 'general',
      start_date TEXT,
      end_date TEXT,
      coupon_code TEXT,
      plan_ids TEXT DEFAULT '[]',
      branch_ids TEXT DEFAULT '[]',
      usage_limit INTEGER DEFAULT 100,
      used_count INTEGER DEFAULT 0,
      min_purchase REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      max_uses INTEGER DEFAULT 100,
      used_count INTEGER DEFAULT 0,
      valid_from TEXT,
      valid_until TEXT,
      plan_ids TEXT DEFAULT '[]',
      branch_ids TEXT DEFAULT '[]',
      min_purchase REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    -- BLOG
    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      featured_image TEXT,
      author_id INTEGER,
      category TEXT DEFAULT 'fitness',
      tags TEXT DEFAULT '[]',
      content TEXT,
      excerpt TEXT,
      seo_title TEXT,
      meta_description TEXT,
      canonical_url TEXT,
      is_published INTEGER DEFAULT 0,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS blog_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT
    );

    -- FAQ
    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    -- LOCATIONS
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      phone TEXT,
      email TEXT,
      opening_hours TEXT DEFAULT '{}',
      map_embed_url TEXT,
      facilities TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1
    );

    -- CONTACT SUBMISSIONS
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- APPOINTMENTS
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      trainer_id INTEGER,
      type TEXT DEFAULT 'consultation',
      date TEXT,
      time TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trainer_id) REFERENCES trainers(id)
    );

    -- FINANCE & BILLING TABLES
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      membership_id INTEGER,
      branch_id INTEGER,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax_rate REAL DEFAULT 18,
      tax_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      due_date TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      item_type TEXT DEFAULT 'membership',
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_number TEXT UNIQUE,
      invoice_id INTEGER,
      membership_id INTEGER,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      method TEXT DEFAULT 'cash',
      razorpay_payment_id TEXT,
      razorpay_order_id TEXT,
      razorpay_signature TEXT,
      transaction_ref TEXT,
      status TEXT DEFAULT 'pending',
      refund_amount REAL DEFAULT 0,
      refund_reason TEXT,
      branch_id INTEGER,
      received_by INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      processed_by INTEGER,
      processed_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_id) REFERENCES payments(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      branch_id INTEGER,
      vendor TEXT,
      payment_method TEXT DEFAULT 'cash',
      receipt_url TEXT,
      status TEXT DEFAULT 'approved',
      approved_by INTEGER,
      approved_at TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (branch_id) REFERENCES branches(id)
    );

    -- INVENTORY / POS TABLES
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE,
      barcode TEXT,
      category TEXT,
      description TEXT,
      purchase_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      minimum_stock INTEGER DEFAULT 10,
      unit TEXT DEFAULT 'piece',
      supplier TEXT,
      branch_id INTEGER,
      image TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reference_id INTEGER,
      reference_type TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS pos_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      branch_id INTEGER,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      payment_status TEXT DEFAULT 'paid',
      cashier_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pos_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES pos_orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- SUPPORT / TICKETS
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT UNIQUE,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      priority TEXT DEFAULT 'medium',
      subject TEXT NOT NULL,
      description TEXT,
      assigned_to INTEGER,
      status TEXT DEFAULT 'open',
      sla_deadline TEXT,
      resolved_at TEXT,
      resolution TEXT,
      rating INTEGER,
      feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      attachments TEXT DEFAULT '[]',
      is_internal INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );

    -- TASK MANAGEMENT
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      assigned_to INTEGER,
      assigned_by INTEGER,
      department TEXT,
      priority TEXT DEFAULT 'medium',
      due_date TEXT,
      status TEXT DEFAULT 'todo',
      completion_notes TEXT,
      completed_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (assigned_by) REFERENCES users(id)
    );

    -- NOTIFICATIONS
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      message TEXT,
      type TEXT DEFAULT 'info',
      module TEXT,
      reference_id INTEGER,
      reference_type TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ANNOUNCEMENTS
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      target TEXT DEFAULT 'all',
      target_ids TEXT DEFAULT '[]',
      priority TEXT DEFAULT 'normal',
      start_date TEXT,
      end_date TEXT,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- MARKETING / CAMPAIGNS
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      budget REAL DEFAULT 0,
      spent REAL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      target_audience TEXT,
      leads_generated INTEGER DEFAULT 0,
      conversions INTEGER DEFAULT 0,
      revenue REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- REFERRALS
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      referral_code TEXT UNIQUE NOT NULL,
      referred_name TEXT,
      referred_phone TEXT,
      referred_email TEXT,
      lead_id INTEGER,
      converted INTEGER DEFAULT 0,
      reward_status TEXT DEFAULT 'pending',
      reward_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referrer_id) REFERENCES users(id)
    );

    -- DOCUMENTS
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      uploaded_by INTEGER,
      name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      category TEXT DEFAULT 'general',
      entity_type TEXT,
      entity_id INTEGER,
      is_private INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- AUDIT LOGS
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      entity_name TEXT,
      previous_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- SITE SETTINGS
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      category TEXT DEFAULT 'general',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- AUTOMATION RULES
    CREATE TABLE IF NOT EXISTS automation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_config TEXT DEFAULT '{}',
      action_type TEXT NOT NULL,
      action_config TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      last_triggered TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

module.exports = { createTables };
