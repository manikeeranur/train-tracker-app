import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }) {
  const { next } = await searchParams;
  return <AuthForm mode="signup" next={next} />;
}
