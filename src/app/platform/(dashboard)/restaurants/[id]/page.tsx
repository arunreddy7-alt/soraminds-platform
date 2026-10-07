import { Suspense } from "react";
import RestaurantDetailsClient from "./RestaurantDetailsClient";

export default function RestaurantDetailsPage() {
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
      <RestaurantDetailsClient />
    </Suspense>
  );
}