import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

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

  private observer?: IntersectionObserver;

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set(window.scrollY > 60);
  }

  openNav() {
    this.mobileNavOpen.set(true);
  }

  closeNav() {
    this.mobileNavOpen.set(false);
  }

  ngAfterViewInit(): void {
    const els = this.elRef.nativeElement.querySelectorAll('.reveal');
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('vis');
        });
      },
      { threshold: 0.08 },
    );
    els.forEach((el: Element) => this.observer!.observe(el));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
