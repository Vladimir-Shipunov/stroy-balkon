/**
 * @file Single source of truth for БАЛКОН-МСК marketing content.
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
  readonly priceFrom: string;
  readonly unit: string;
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
  readonly category: 'Лоджия' | 'Балкон' | 'Под ключ' | 'Объединение';
  readonly area: string;
  readonly term: string;
  readonly tone: 'gold' | 'slate' | 'wood' | 'sky' | 'stone';
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
  name: 'БАЛКОН-МСК',
  legalNote: '«БАЛКОН-МСК», 2025. Все права защищены',
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
    priceFrom: '18 000',
    unit: '₽ / пог. м',
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
    priceFrom: '12 000',
    unit: '₽ / м²',
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
    priceFrom: '35 000',
    unit: '₽ под ключ',
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
    priceFrom: '25 000',
    unit: '₽ от',
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
    priceFrom: '55 000',
    unit: '₽ от',
    tone: 'gold',
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
    priceFrom: '9 000',
    unit: '₽ от',
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
    title: 'Фиксированная смета',
    body: 'Стоимость в договоре не меняется. Все материалы и работы прописаны до начала монтажа.',
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
    title: 'Рассрочка 0%',
    body: 'Оплата по этапам или рассрочка без переплат от банков-партнёров. Приём карт и наличных.',
  },
];

export const STEPS: readonly Step[] = [
  {
    n: '01',
    title: 'Заявка и замер',
    body: 'Оставляете заявку — приезжаем на бесплатный замер в удобное время, обсуждаем задачи и бюджет.',
  },
  {
    n: '02',
    title: 'Проект и смета',
    body: 'Собираете балкон в конфигураторе или с дизайнером. Готовим фиксированную смету и договор.',
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
    text: 'Делали объединение балкона с кухней. Всё по смете, без сюрпризов по цене. Французское остекление выглядит дорого. Рекомендую.',
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
    title: 'Тёплая лоджия с кабинетом',
    category: 'Лоджия',
    area: '3,2 м',
    term: '11 дней',
    tone: 'wood',
    summary: 'Тёплое остекление Rehau, утепление пеноплэксом, МДФ-панели и тёплый пол.',
  },
  {
    id: 'p2',
    title: 'Панорамный балкон с видом',
    category: 'Балкон',
    area: '4,0 м',
    term: '8 дней',
    tone: 'sky',
    summary: 'Панорамное остекление в пол, минимум профиля, кварцвинил на полу.',
  },
  {
    id: 'p3',
    title: 'Балкон «хрущёвка» под ключ',
    category: 'Под ключ',
    area: '2,8 м',
    term: '7 дней',
    tone: 'gold',
    summary: 'Вынос по подоконнику, ПВХ-панели, точечный свет и откидной столик.',
  },
  {
    id: 'p4',
    title: 'Объединение с гостиной',
    category: 'Объединение',
    area: '5,1 м',
    term: '16 дней',
    tone: 'slate',
    summary: 'Демонтаж блока, французское остекление, тёплый контур и подсветка ленты.',
  },
  {
    id: 'p5',
    title: 'Скандинавская лоджия',
    category: 'Лоджия',
    area: '3,5 м',
    term: '12 дней',
    tone: 'stone',
    summary: 'Декоративный камень и евровагонка, реечный потолок, зона отдыха с диваном.',
  },
  {
    id: 'p6',
    title: 'Балкон-гардеробная',
    category: 'Под ключ',
    area: '3,0 м',
    term: '10 дней',
    tone: 'wood',
    summary: 'Встроенные шкафы во всю стену, ламинат, тёплое остекление и LED-подсветка.',
  },
];
