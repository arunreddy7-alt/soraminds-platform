import { Suspense } from "react";
import PlatformSidebar from "@/components/platform/PlatformSidebar";
import PlatformHeader from "@/components/platform/PlatformHeader";

export default function PlatformDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#f5f6f8",
      }}
    >
      <Suspense
        fallback={
          <aside
            style={{
              width: "240px",
              minHeight: "100vh",
              background: "#ffffff",
              borderRight: "1px solid #e7e9ed",
            }}
          />
        }
      >
        <PlatformSidebar />
      </Suspense>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <PlatformHeader />

        <main
          style={{
            flex: 1,
            padding: "30px",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}