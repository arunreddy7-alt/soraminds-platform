import { Suspense } from "react";
import RestaurantEditClient from "./RestaurantEditClient";

export default function RestaurantEditPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: "30px",
            fontSize: "14px",
            color: "#777d87",
          }}
        >
          Loading restaurant...
        </div>
      }
    >
      <RestaurantEditClient />
    </Suspense>
  );
}