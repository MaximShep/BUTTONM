import Link from "next/link";
import { Button } from "@/components/ui/Button";

type AppShellProps = {
  login: string;
  children: React.ReactNode;
};

export function AppShell({ login, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/dashboard" className="text-base font-normal tracking-tight text-slate-950">
            UGC Scripts
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="text-slate-500 transition-colors hover:text-slate-950">
              Проекты
            </Link>
            <Link href="/settings/style" className="text-slate-500 transition-colors hover:text-slate-950">
              Стиль
            </Link>
            <span className="hidden text-slate-400 sm:inline">{login}</span>
            <form action="/api/logout" method="post">
              <Button variant="outline" size="sm">
                Выйти
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12">{children}</main>
    </div>
  );
}
