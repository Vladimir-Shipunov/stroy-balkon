/**
 * @file Single source of truth for STROY-BALKON marketing content.
 *
 * Real Russian copy for a Moscow balcony-renovation company — no placeholders.
 * Pages import from here so content stays consistent and easy to edit.
 */

export interface NavLink {
  readonly label: string;
  readonly to: string;
}

export interface Service {
  readonly id: string;
  readonly title: string;
  readonly tagline: string;
  readonly features: readonly string[];
  /** Accent tint used by the card artwork. */
  readonly tone: 'gold' | 'slate' | 'wood' | 'sky';
}

export interface Reason {
  readonly title: string;
  readonly body: string;
}

export interface Review {
  readonly author: string;
  readonly meta: string;
  readonly text: string;
  readonly rating: number;
}

export interface ProjectItem {
  readonly id: string;
  readonly title: string;
  readonly category:
    | 'Панорамное остекление'
    | 'Отделка под дерево'
    | 'Светлая отделка'
    | 'Каменная отделка';
  readonly image: string;
  readonly imageAlt: string;
  readonly summary: string;
}

export interface Step {
  readonly n: string;
  readonly title: string;
  readonly body: string;
}

export interface Stat {
  readonly value: string;
  readonly label: string;
}

export const COMPANY = {
  name: 'STROY-BALKON',
  legalNote: '«STROY-BALKON», 2025. Все права защищены',
  tagline: 'Отделка и остекление балконов под ключ',
  city: 'Москва и область',
  phonePrimary: { display: '+7 (908) 836-06-06', href: 'tel:+79088360606' },
  phoneSecondary: { display: '+7 (909) 993-12-17', href: 'tel:+79099931217' },
  email: { display: 'kurgankk@mail.ru', href: 'mailto:kurgankk@mail.ru' },
  address: 'г. Москва, работаем по всей Москве и Московской области',
  hours: 'Ежедневно с 9:00 до 21:00',
  mapHref:
    'https://yandex.ru/maps/?ll=37.626789%2C55.616768&mode=whatshere&whatshere%5Bpoint%5D=37.626789%2C55.616768&whatshere%5Bzoom%5D=17&z=17',
  social: {
    instagram: 'https://instagram.com/balkon.msk?igshid=YmMyMTA2M2Y=',
    vk: 'https://vk.com/balkon_msk1',
    telegram: 'https://t.me/Balkon_Moscow',
    avito:
      'https://www.avito.ru/user/e0780a5d9e65235385c024ac52d8bc12/profile?src=sharing',
  },
} as const;

export const NAV_LINKS: readonly NavLink[] = [
  { label: 'Главная', to: '/' },
  { label: 'Услуги', to: '/services' },
  { label: 'Портфолио', to: '/portfolio' },
  { label: 'О компании', to: '/about' },
  { label: 'Контакты', to: '/contacts' },
];

export const STATS: readonly Stat[] = [
  { value: '12 лет', label: 'на рынке Москвы' },
  { value: '2 400+', label: 'балконов под ключ' },
  { value: '5 лет', label: 'гарантия на работы' },
  { value: '14 дней', label: 'средний срок' },
];

export const SERVICES: readonly Service[] = [
  {
    id: 'glazing',
    title: 'Остекление балконов',
    tagline: 'Тёплое и холодное остекление профилями Rehau, KBE, Provedal',
    tone: 'sky',
    features: [
      'Тёплый профиль с двухкамерным стеклопакетом',
      'Холодный алюминий Provedal',
      'Панорамное и французское остекление',
      'Вынос по подоконнику до 30 см',
    ],
  },
  {
    id: 'insulation',
    title: 'Утепление под ключ',
    tagline: 'Превращаем балкон в тёплую комнату на весь год',
    tone: 'gold',
    features: [
      'Пеноплэкс + пенофол, контур без мостиков холода',
      'Тёплый пол по желанию',
      'Пароизоляция и вентзазор',
      'Электрика и розетки',
    ],
  },
  {
    id: 'finishing',
    title: 'Отделка балкона',
    tagline: 'Стены, потолок и пол — от черновой до чистовой',
    tone: 'wood',
    features: [
      'МДФ-панели, ПВХ, вагонка, декоративный камень',
      'Реечный и натяжной потолок',
      'Ламинат, кварцвинил, керамогранит',
      'Подсветка и точечный свет',
    ],
  },
  {
    id: 'roof',
    title: 'Крыша на балкон',
    tagline: 'Для верхних этажей — независимая или зависимая крыша',
    tone: 'slate',
    features: [
      'Металлокаркас с антикоррозийной обработкой',
      'Кровельный профлист, поликарбонат',
      'Шумоизоляция от дождя',
      'Герметизация примыканий',
    ],
  },
  {
    id: 'merge',
    title: 'Объединение с комнатой',
    tagline: 'Расширяем пространство квартиры за счёт балкона',
    tone: 'sky',
    features: [
      'Демонтаж порога и подоконного блока',
      'Тёплый контур и тёплый пол',
      'Французский балкон или раздвижная перегородка',
      'Консультация по согласованию',
    ],
  },
  {
    id: 'furniture',
    title: 'Мебель и хранение',
    tagline: 'Встроенные шкафы, полки и зона отдыха по размеру',
    tone: 'wood',
    features: [
      'Встроенные шкафы и тумбы',
      'Откидные столы и сиденья с ящиками',
      'Открытые полки и стеллажи',
      'Изготовление по индивидуальным размерам',
    ],
  },
];

export const REASONS: readonly Reason[] = [
  {
    title: 'Свои бригады, без посредников',
    body: 'Замерщики, монтажники и отделочники — штатные сотрудники. Никаких субподрядов и накруток.',
  },
  {
    title: 'Понятный план работ',
    body: 'Все материалы и этапы согласуем до начала монтажа.',
  },
  {
    title: 'Гарантия 5 лет',
    body: 'На остекление, утепление и отделку. Сервисное обслуживание и регулировка фурнитуры.',
  },
  {
    title: 'Сдаём в срок',
    body: 'Стандартный балкон под ключ — за 7–14 дней. За срыв сроков по нашей вине — компенсация.',
  },
  {
    title: 'Чистый монтаж',
    body: 'Защищаем квартиру плёнкой, выносим мусор. После бригады остаётся только убрать пыль.',
  },
  {
    title: 'Подбор решения',
    body: 'Помогаем выбрать материалы и оформление с учётом особенностей помещения.',
  },
];

export const STEPS: readonly Step[] = [
  {
    n: '01',
    title: 'Заявка и замер',
    body: 'Оставляете заявку — приезжаем на замер в удобное время и обсуждаем ваши задачи.',
  },
  {
    n: '02',
    title: 'Проект и план работ',
    body: 'Собираете балкон в конфигураторе или с дизайнером. Согласуем состав работ и договор.',
  },
  {
    n: '03',
    title: 'Монтаж',
    body: 'Остекление, утепление и отделка одной бригадой. Контроль качества на каждом этапе.',
  },
  {
    n: '04',
    title: 'Сдача под ключ',
    body: 'Проверяем работу фурнитуры, убираем за собой и выдаём гарантию на 5 лет.',
  },
];

export const REVIEWS: readonly Review[] = [
  {
    author: 'Ирина М.',
    meta: 'Лоджия 3 м, Бутово',
    rating: 5,
    text: 'Остеклили и утеплили лоджию за 9 дней. Теперь это полноценный кабинет — зимой тепло без обогревателя. Спасибо за аккуратность!',
  },
  {
    author: 'Алексей и Светлана',
    meta: 'Балкон «хрущёвка», Чертаново',
    rating: 5,
    text: 'Переживали из-за маленького балкона, но ребята предложили вынос по подоконнику. Стало заметно просторнее, отделка МДФ — как на картинке в конфигураторе.',
  },
  {
    author: 'Дмитрий К.',
    meta: 'Объединение с кухней, Москва',
    rating: 5,
    text: 'Делали объединение балкона с кухней. Всё подробно согласовали до начала работ, без неожиданностей. Французское остекление выглядит отлично. Рекомендую.',
  },
  {
    author: 'Наталья В.',
    meta: 'Панорамный балкон, ЖК «Скандинавия»',
    rating: 5,
    text: 'Панорамное остекление в пол — мечта сбылась. Вид на город теперь открыточный. Менеджер на связи на каждом этапе.',
  },
];

export const PROJECTS: readonly ProjectItem[] = [
  {
    id: 'p1',
    title: 'Лоджия с фактурной каменной отделкой',
    category: 'Каменная отделка',
    image: '/assets/images/projects/portfolio-01.webp',
    imageAlt: 'Фактурная светлая отделка стен лоджии и тёмный пол',
    summary: 'Светлая фактурная отделка стен сочетается с контрастным напольным покрытием.',
  },
  {
    id: 'p2',
    title: 'Лоджия с каменной отделкой и шкафом',
    category: 'Каменная отделка',
    image: '/assets/images/projects/portfolio-02.webp',
    imageAlt: 'Каменная отделка под окном и встроенный шкаф на лоджии',
    summary: 'Фактурная стена сочетается с окном и встроенным местом для хранения.',
  },
  {
    id: 'p3',
    title: 'Компактная лоджия с видом на город',
    category: 'Панорамное остекление',
    image: '/assets/images/projects/portfolio-03.webp',
    imageAlt: 'Остеклённая лоджия с видом на жилые дома',
    summary: 'Компактное пространство с большими окнами и видом на город.',
  },
  {
    id: 'p4',
    title: 'Деревянные рейки и кирпичная стена',
    category: 'Отделка под дерево',
    image: '/assets/images/projects/portfolio-04.webp',
    imageAlt: 'Деревянные рейки, кирпичная стена и остекление лоджии',
    summary: 'Разные фактуры дерева и кирпича создают выразительный акцент.',
  },
  {
    id: 'p5',
    title: 'Лоджия с зелёной акцентной стеной',
    category: 'Отделка под дерево',
    image: '/assets/images/projects/portfolio-05.webp',
    imageAlt: 'Зелёная стена, деревянная отделка и окна в лоджии',
    summary: 'Насыщенный зелёный оттенок выделяется на фоне тёплой деревянной отделки.',
  },
  {
    id: 'p6',
    title: 'Светлая лоджия с деревянной отделкой',
    category: 'Отделка под дерево',
    image: '/assets/images/projects/portfolio-06.webp',
    imageAlt: 'Светлая деревянная обшивка стен и потолка лоджии',
    summary: 'Светлая обшивка стен и потолка объединяет интерьер.',
  },
  {
    id: 'p7',
    title: 'Лоджия с отделкой под серое дерево',
    category: 'Отделка под дерево',
    image: '/assets/images/projects/portfolio-07.webp',
    imageAlt: 'Серо-бежевая отделка стен и встроенное место для хранения',
    summary: 'Сдержанный оттенок и встроенное хранение помогают сохранить порядок.',
  },
  {
    id: 'p8',
    title: 'Отделка под дерево со встроенным шкафом',
    category: 'Отделка под дерево',
    image: '/assets/images/projects/portfolio-08.webp',
    imageAlt: 'Деревянная отделка и встроенный шкаф на узкой лоджии',
    summary: 'Вертикальные панели и встроенный шкаф используют пространство по максимуму.',
  },
  {
    id: 'p9',
    title: 'Тёплая отделка с длинной встроенной полкой',
    category: 'Отделка под дерево',
    image: '/assets/images/projects/portfolio-09.webp',
    imageAlt: 'Деревянная отделка и широкая встроенная полка у окон',
    summary: 'Тёплые древесные оттенки и длинная полка вдоль окна.',
  },
  {
    id: 'p10',
    title: 'Голубая отделка с белыми панелями',
    category: 'Светлая отделка',
    image: '/assets/images/projects/portfolio-10.webp',
    imageAlt: 'Голубые стеновые панели и белые оконные рамы на лоджии',
    summary: 'Сочетание голубых стен и белых рам создаёт лёгкий, чистый интерьер.',
  },
  {
    id: 'p11',
    title: 'Лоджия с белой отделкой',
    category: 'Светлая отделка',
    image: '/assets/images/projects/portfolio-11.webp',
    imageAlt: 'Светлая лоджия с белыми панелями, окном и светлым полом',
    summary: 'Нейтральные светлые поверхности сохраняют ощущение простора.',
  },
  {
    id: 'p12',
    title: 'Светлая лоджия с панорамным остеклением',
    category: 'Панорамное остекление',
    image: '/assets/images/projects/portfolio-12.webp',
    imageAlt: 'Светлая лоджия с остеклением и видом на жилые дома',
    summary: 'Панорамное остекление и светлая отделка делают пространство воздушным.',
  },
];
