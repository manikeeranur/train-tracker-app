import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }) {
  const { next } = await searchParams;
  return <AuthForm mode="login" next={next} />;
}
