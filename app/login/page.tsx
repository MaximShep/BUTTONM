import { requireAnonymous } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await requireAnonymous();
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Вход</CardTitle>
          <CardDescription>Доступ к проектам блогера</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/login" method="post">
            {error ? (
              <p className="mb-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error === "empty" ? "Введите логин и пароль." : "Неверный логин или пароль."}
              </p>
            ) : null}
            <Label htmlFor="login">Логин</Label>
            <Input id="login" name="login" autoComplete="username" required />
            <Label className="mt-4" htmlFor="password">
              Пароль
            </Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
            <Button className="mt-6 w-full">Войти</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
