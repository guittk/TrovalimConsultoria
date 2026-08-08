import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Número da faixa de credibilidade (logo abaixo do hero). */
interface Stat {
  /** Valor final do contador animado. */
  value: number;
  /** Sufixo colado no número (ex: '+', '%', 'd'). */
  suffix: string;
  label: string;
}

/** Serviço da jornada 01→05 da seção "Para Empresas". */
interface Service {
  n: string;
  /** Verbo-âncora que resume o estágio (ATRAIR, ESTRUTURAR...). */
  verb: string;
  title: string;
  desc: string;
  /** Detalhamento opcional — hoje só o Recrutamento tem etapas próprias. */
  items?: string[];
}

interface Faq {
  q: string;
  a: string;
}

const SECTION_IDS = ['home', 'sobre', 'empresas', 'profissionais', 'depoimentos', 'contato'];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
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
   * Os 5 serviços B2B como jornada de maturidade organizacional
   * (atrair → estruturar → alinhar → desenvolver → liderar). São
   * contratáveis isoladamente — a numeração é narrativa, não pacote fechado.
   */
  readonly services: Service[] = [
    {
      n: '01',
      verb: 'Atrair',
      title: 'Recrutamento e Seleção',
      desc: 'Encontramos os talentos certos para a sua empresa, com um olhar que vai além do currículo — avaliamos competências técnicas e comportamentais para garantir aderência real à cultura e aos objetivos do negócio.',
      items: [
        'Diagnóstico — entendimento da cultura, cargo e perfil ideal',
        'Mapeamento — busca ativa de candidatos aderentes ao perfil',
        'Avaliação — triagem técnica e comportamental estruturada',
        'Apresentação — shortlist qualificado e suporte na decisão final',
      ],
    },
    {
      n: '02',
      verb: 'Estruturar',
      title: 'Estruturação de Cargos e Salários',
      desc: 'Organizamos a estrutura de cargos e salários da empresa com critérios claros e justos, trazendo mais organização para os processos internos e clareza para o colaborador sobre o que se espera dele em cada função. Isso também abre espaço para que ele enxergue seu plano de crescimento dentro da empresa, com perspectiva real de futuro.',
    },
    {
      n: '03',
      verb: 'Alinhar',
      title: 'Gestão Estratégica de Pessoas',
      desc: 'Estruturamos processos de RH alinhados à estratégia da empresa, conectando cargos, salários e indicadores de performance com os resultados que o negócio precisa alcançar.',
    },
    {
      n: '04',
      verb: 'Desenvolver',
      title: 'Desenvolvimento Humano e Organizacional',
      desc: 'Trabalhamos o desenvolvimento contínuo das pessoas dentro da organização — mapeando competências, criando planos de crescimento e fortalecendo a cultura para que cada colaborador entenda seu propósito e seu impacto no todo.',
    },
    {
      n: '05',
      verb: 'Liderar',
      title: 'Desenvolvimento de Lideranças',
      desc: 'Formamos líderes mais conscientes e estratégicos, capazes de engajar times, tomar decisões com mais clareza e criar ambientes de trabalho saudáveis e produtivos.',
    },
  ];

  /**
   * Perguntas respondidas só com o que já é verdade na página (escopo,
   * método, formato de contratação). Perguntas de preço, prazo contratual e
   * política de garantia ficaram de fora de propósito — dependem de
   * informação comercial real.
   */
  readonly faqs: Faq[] = [
    {
      q: 'Preciso contratar todos os serviços ou posso começar por um?',
      a: 'Pode começar por um. A numeração de 01 a 05 mostra como os serviços se conectam numa jornada de maturidade, mas cada um é contratado de forma independente, conforme a necessidade do momento da empresa.',
    },
    {
      q: 'Qual a diferença entre recrutamento por competência e um processo tradicional?',
      a: 'No processo tradicional, a triagem gira em torno do currículo e da experiência declarada. No recrutamento por competência, avaliamos também competências comportamentais, fit cultural e potencial — o que reduz o risco de uma contratação tecnicamente correta, mas desalinhada com a cultura e os objetivos do negócio.',
    },
    {
      q: 'Atende profissionais individuais ou só empresas?',
      a: 'Os dois. Para empresas, a atuação é de consultoria de RH (recrutamento, cargos e salários, gestão estratégica, DHO e lideranças). Para profissionais, há consultoria de currículo, otimização de LinkedIn e orientação de carreira.',
    },
    {
      q: 'O acompanhamento termina quando o candidato é contratado?',
      a: 'Não. O acompanhamento vai do briefing até a integração da pessoa contratada, com comunicação transparente em cada etapa do processo.',
    },
    {
      q: 'Como começa uma conversa?',
      a: 'Pelo WhatsApp ou e-mail, com uma escuta inicial sobre o seu contexto. Antes de qualquer proposta técnica, o primeiro passo é entender o desafio real — só depois desenhamos o caminho.',
    },
  ];

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

  openNav() {
    this.mobileNavOpen.set(true);
  }

  closeNav() {
    this.mobileNavOpen.set(false);
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
  }
}
