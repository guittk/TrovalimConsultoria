import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ContactSubmissionsService } from '../core/contact-submissions.service';
import { lockBodyScroll, unlockBodyScroll } from '../shared/body-scroll-lock';

const SUBJECT_OPTIONS = [
  { value: 'empresa', label: 'Sou empresa · recrutamento e consultoria de RH' },
  { value: 'carreira', label: 'Sou profissional · carreira, currículo ou LinkedIn' },
  { value: 'outro', label: 'Outro assunto' },
] as const;

/** Número da faixa de credibilidade (logo abaixo do hero). */
interface Stat {
  /** Valor final do contador animado. */
  value: number;
  /** Sufixo colado no número (ex: '+', '%', 'd'). */
  suffix: string;
  label: string;
}

/** Serviço da seção "Para Empresas". */
interface Service {
  title: string;
  desc: string;
}

/** Serviço da seção "Para Você" — mesmo formato e visual dos serviços B2B. */
interface PersonalService {
  title: string;
  desc: string;
}

interface Faq {
  q: string;
  a: string;
}

const SECTION_IDS = ['home', 'sobre', 'empresas', 'profissionais', 'depoimentos', 'contato'];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  private readonly elRef = inject(ElementRef<HTMLElement>);

  readonly scrolled = signal(false);
  readonly mobileNavOpen = signal(false);
  readonly scrollProgress = signal(0);
  readonly activeSection = signal('home');
  readonly openFaq = signal<number | null>(0);

  /** Índices expandidos dos serviços B2B (seção Empresas) — só título fica visível por padrão. */
  readonly openServices = signal<Set<number>>(new Set());
  toggleService(i: number): void {
    this.openServices.update((cur) => {
      const next = new Set(cur);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  /** Mesmo padrão, para os serviços individuais (seção Para Você). */
  readonly openPersonal = signal<Set<number>>(new Set());
  togglePersonal(i: number): void {
    this.openPersonal.update((cur) => {
      const next = new Set(cur);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  /**
   * Números da faixa de credibilidade. Proposital e necessariamente VAZIO:
   * são dados reais da consultoria (anos de atuação, empresas atendidas,
   * tempo médio de fechamento de vaga, taxa de permanência...) e inventá-los
   * seria fabricar credencial. A seção inteira só é renderizada quando este
   * array tiver conteúdo — então basta preencher aqui que ela aparece.
   *
   * Exemplo do formato esperado (descomente e ajuste com os dados reais):
   *   { value: 12,  suffix: '+', label: 'Anos de experiência' },
   *   { value: 80,  suffix: '+', label: 'Empresas atendidas' },
   *   { value: 30,  suffix: 'd', label: 'Tempo médio de fechamento' },
   *   { value: 92,  suffix: '%', label: 'Permanência após 1 ano' },
   */
  readonly stats: Stat[] = [];

  /** Valores exibidos durante a animação de contagem. */
  readonly statValues = signal<number[]>([]);
  private statsAnimated = false;

  /**
   * Credenciais formais (formação, CRP, pós, certificações). Mesmo critério
   * dos números: vazio até virem os dados reais, e o bloco só renderiza
   * quando preenchido.
   *
   * Exemplo: 'Psicóloga · CRP 06/000000', 'Pós em Gestão de Pessoas — FGV'
   */
  readonly credentials: string[] = [];

  /**
   * Serviços B2B. Sem numeração de propósito: cada um é contratado de forma
   * independente, então uma sequência visual sugeriria um pacote fechado.
   */
  readonly services: Service[] = [
    {
      title: 'Recrutamento e Seleção por Competência',
      desc: 'Processo seletivo estruturado com base em competências técnicas e comportamentais, garantindo contratações mais assertivas e alinhadas à cultura e às necessidades da empresa.',
    },
    {
      title: 'Avaliação de Soft Skills e Competências Comportamentais',
      desc: 'Aplicação de ferramentas e metodologias para mapear o perfil comportamental de candidatos e colaboradores, apoiando decisões de contratação, promoção e formação de equipes.',
    },
    {
      title: 'Estruturação de Cargos e Salários',
      desc: 'Desenho de planos de cargos, carreiras e remuneração, com definição de níveis, faixas salariais e critérios de progressão, trazendo equidade interna e competitividade externa.',
    },
    {
      title: 'Gestão Estratégica de Pessoas',
      desc: 'Consultoria em políticas e práticas de RH alinhadas à estratégia do negócio, cobrindo desde clima organizacional até indicadores de desempenho da área de gente e gestão.',
    },
    {
      title: 'Desenvolvimento Humano e Organizacional',
      desc: 'Programas voltados ao crescimento das equipes e da organização como um todo: cultura, engajamento, treinamentos e processos de mudança organizacional.',
    },
    {
      title: 'Desenvolvimento de Lideranças',
      desc: 'Formação e capacitação de líderes e gestores, com foco em habilidades de gestão de pessoas, comunicação, tomada de decisão e condução de equipes de alta performance.',
    },
  ];

  /** Serviços para profissionais (seção "Para Você"). */
  readonly personalServices: PersonalService[] = [
    {
      title: 'Orientação e Desenvolvimento de Carreira',
      desc: 'Acompanhamento individual para planejar próximos passos profissionais, identificar pontos fortes, definir metas de curto e longo prazo e traçar um plano de ação claro para transição ou evolução de carreira.',
    },
    {
      title: 'Consultoria de Currículo',
      desc: 'Reestruturação e otimização do currículo para destacar suas competências e resultados, aumentando as chances de passar por filtros de recrutadores e sistemas automatizados (ATS).',
    },
    {
      title: 'Otimização de LinkedIn',
      desc: 'Ajuste estratégico do perfil no LinkedIn (headline, resumo, experiências e palavras-chave) para aumentar visibilidade, atrair recrutadores e fortalecer sua marca pessoal no mercado.',
    },
    {
      title: 'Simulação de Entrevistas',
      desc: 'Preparação prática para processos seletivos, com simulação de entrevistas reais e devolutiva estruturada sobre postura, discurso e argumentação, a partir da experiência de quem conduz seleções do outro lado da mesa.',
    },
    {
      title: 'Psicologia Aplicada ao Trabalho',
      desc: 'Suporte psicológico voltado às demandas da vida profissional: ansiedade em processos seletivos, autoconhecimento, gestão emocional e equilíbrio entre vida pessoal e carreira.',
    },
    {
      title: 'Avaliação de Perfil Comportamental e Soft Skills',
      desc: 'Mapeamento das suas competências comportamentais (comunicação, liderança, adaptabilidade etc.), com devolutiva individual para uso em entrevistas, promoções ou autodesenvolvimento.',
    },
  ];

  /**
   * Perguntas respondidas só com o que já é verdade na página (escopo,
   * método, formato de contratação). Perguntas de preço, prazo contratual e
   * política de garantia ficaram de fora de propósito: dependem de
   * informação comercial real.
   */
  readonly faqs: Faq[] = [
    {
      q: 'Qual a diferença entre recrutamento por competência e um processo tradicional?',
      a: 'No processo tradicional, a triagem gira em torno do currículo e da experiência declarada. No recrutamento por competência, avaliamos também competências comportamentais, fit cultural e potencial, o que reduz o risco de uma contratação tecnicamente correta, mas desalinhada com a cultura e os objetivos do negócio.',
    },
    {
      q: 'Atende profissionais individuais ou só empresas?',
      a: 'Os dois. Para empresas, a atuação é de consultoria de RH: recrutamento por competência, avaliação comportamental, cargos e salários, gestão estratégica de pessoas, desenvolvimento humano e organizacional e formação de lideranças. Para profissionais, há orientação de carreira, consultoria de currículo, otimização de LinkedIn, psicologia aplicada ao trabalho e avaliação de perfil comportamental.',
    },
    {
      q: 'O acompanhamento termina quando o candidato é contratado?',
      a: 'Não. O acompanhamento vai do briefing até a integração da pessoa contratada, com comunicação transparente em cada etapa do processo.',
    },
    {
      q: 'Como começa uma conversa?',
      a: 'Pelo WhatsApp ou e-mail, com uma escuta inicial sobre o seu contexto. Antes de qualquer proposta técnica, o primeiro passo é entender o desafio real. Só depois desenhamos o caminho.',
    },
  ];

  /*
    Formulário de contato. O envio salva a mensagem direto no Firestore
    (coleção contactSubmissions) — ainda não existe uma tela na plataforma
    pra consumir esses envios, mas os dados já ficam guardados pra quando
    ela existir.
  */
  private readonly contactSubmissions = inject(ContactSubmissionsService);

  readonly subjectOptions = SUBJECT_OPTIONS;
  readonly contactName = signal('');
  readonly contactEmail = signal('');
  readonly contactPhone = signal('');
  readonly contactSubject = signal<string>('empresa');
  readonly contactMessage = signal('');
  readonly contactTried = signal(false);
  readonly contactSending = signal(false);
  readonly contactSent = signal(false);

  private readonly emailValid = computed(() => {
    const v = this.contactEmail().trim();
    return v.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  });

  readonly contactErrors = computed(() => ({
    name: this.contactName().trim().length < 2,
    message: this.contactMessage().trim().length < 10,
    email: !this.emailValid(),
  }));

  readonly contactFormValid = computed(() => {
    const e = this.contactErrors();
    return !e.name && !e.message && !e.email;
  });

  async sendContact(): Promise<void> {
    this.contactTried.set(true);
    if (!this.contactFormValid() || this.contactSending()) return;

    this.contactSending.set(true);
    try {
      await this.contactSubmissions.create({
        name: this.contactName().trim(),
        email: this.contactEmail().trim() || undefined,
        phone: this.contactPhone().trim() || undefined,
        subject: this.contactSubject(),
        message: this.contactMessage().trim(),
      });
      this.contactSent.set(true);
      this.contactTried.set(false);
      this.contactName.set('');
      this.contactEmail.set('');
      this.contactPhone.set('');
      this.contactSubject.set('empresa');
      this.contactMessage.set('');
    } finally {
      this.contactSending.set(false);
    }
  }

  private revealObserver?: IntersectionObserver;
  private sectionObserver?: IntersectionObserver;
  private statsObserver?: IntersectionObserver;
  private countRaf?: number;
  private failsafeTimer?: ReturnType<typeof setTimeout>;

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set(window.scrollY > 60);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.scrollProgress.set(max > 0 ? Math.min((window.scrollY / max) * 100, 100) : 0);
  }

  /*
    Trava o scroll da página atrás do menu mobile — sem isso, dava pra
    arrastar o conteúdo por baixo do painel enquanto ele estava aberto.
  */
  openNav() {
    this.mobileNavOpen.set(true);
    lockBodyScroll();
  }

  closeNav() {
    this.mobileNavOpen.set(false);
    unlockBodyScroll();
  }

  toggleNav() {
    this.mobileNavOpen() ? this.closeNav() : this.openNav();
  }

  toggleFaq(i: number) {
    this.openFaq.update((cur) => (cur === i ? null : i));
  }

  ngAfterViewInit(): void {
    const root = this.elRef.nativeElement as HTMLElement;

    /*
      Portão de animação. Todo o conteúdo animado nasce em opacity:0 e só
      aparece quando o IntersectionObserver marca .vis — ou seja, se o JS
      não rodar, a landing page inteira ficaria em branco. Esta classe é
      aplicada só depois que os observers foram montados, e o CSS esconde
      os elementos apenas quando ela está presente: sem JS, nada é
      escondido e a página aparece normalmente (só sem animação).
    */
    root.classList.add('anim-ready');

    // Stagger automático: cada filho direto de .stagger recebe seu índice,
    // que o CSS usa como multiplicador de transition-delay. Evita ter que
    // escrever transition-delay inline item a item no template.
    root.querySelectorAll('.stagger').forEach((group) => {
      Array.from(group.children).forEach((child, i) => {
        (child as HTMLElement).style.setProperty('--i', String(i));
      });
    });

    this.revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('vis');
            this.revealObserver!.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    root.querySelectorAll('.reveal').forEach((el) => this.revealObserver!.observe(el));

    // Seção ativa na nav: rootMargin recorta a viewport numa faixa central,
    // então a seção "ativa" é a que ocupa o meio da tela, não a que
    // encostou na borda.
    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) this.activeSection.set(entry.target.id);
        });
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) this.sectionObserver!.observe(el);
    });

    const strip = root.querySelector('.stats-strip');
    if (strip && this.stats.length) {
      this.statValues.set(this.stats.map(() => 0));
      this.statsObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting) && !this.statsAnimated) {
            this.statsAnimated = true;
            this.animateCounters();
            this.statsObserver?.disconnect();
          }
        },
        { threshold: 0.4 },
      );
      this.statsObserver.observe(strip);
    }

    this.startRevealFailsafe(root);
  }

  /**
   * Rede de segurança para o caso do IntersectionObserver existir mas não
   * entregar callbacks (aba nunca pintada, extensão interferindo, bug de
   * browser). Sem isso, o conteúdo ficaria preso em opacity:0 para sempre.
   *
   * O teste é preciso de propósito: só considera o observer quebrado se
   * houver algum elemento DENTRO da viewport ainda sem .vis. Numa página
   * carregada sem scroll, os blocos abaixo da dobra legitimamente não
   * dispararam ainda — e revelar tudo ali mataria a animação.
   */
  private startRevealFailsafe(root: HTMLElement): void {
    this.failsafeTimer = setTimeout(() => {
      const els = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));
      const observerBroken = els.some((el) => {
        if (el.classList.contains('vis')) return false;
        const r = el.getBoundingClientRect();
        return r.top < window.innerHeight && r.bottom > 0;
      });
      if (!observerBroken) return;

      this.revealObserver?.disconnect();
      this.statsObserver?.disconnect();
      els.forEach((el) => el.classList.add('vis'));
      if (this.stats.length) this.statValues.set(this.stats.map((s) => s.value));
    }, 2500);
  }

  /** Contagem de 0 até o valor final, com a mesma desaceleração das demais animações. */
  private animateCounters(): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.statValues.set(this.stats.map((s) => s.value));
      return;
    }

    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      this.statValues.set(this.stats.map((s) => Math.round(s.value * eased)));
      if (t < 1) this.countRaf = requestAnimationFrame(tick);
    };
    this.countRaf = requestAnimationFrame(tick);
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    this.sectionObserver?.disconnect();
    this.statsObserver?.disconnect();
    if (this.countRaf) cancelAnimationFrame(this.countRaf);
    if (this.failsafeTimer) clearTimeout(this.failsafeTimer);
    if (this.mobileNavOpen()) unlockBodyScroll();
  }
}
