import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <>
      <Navbar role={session.user.role} username={session.user.username} />
      <main className="main-content">
        {children}
      </main>
    </>
  );
}
