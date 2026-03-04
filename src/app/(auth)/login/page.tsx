import LoginComponent from "../../../../components/auth/LoginComponent";
import ThemeToggle from "../../../../components/ui/ThemeToggle";

export default function LoginPage() {
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl justify-end">
        <ThemeToggle />
      </div>
      <LoginComponent />
    </main>
  );
}
