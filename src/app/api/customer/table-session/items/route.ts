import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AddItemRequest = {
  restaurantSlug: string;
  tableSessionId: number;
  productId: number;
  variantId: number | null;
  quantity: number;
};

type CartRequest = {
  restaurantSlug: string;
  tableSessionId: number;
};

type UpdateItemRequest = {
  restaurantSlug: string;
  tableSessionId: number;
  itemId: number;
  quantity: number;
};

type DeleteItemRequest = {
  restaurantSlug: string;
  tableSessionId: number;
  itemId: number;
};

/* --------------------------------
   HELPERS
-------------------------------- */

async function getRestaurant(
  supabase: ReturnType<typeof createAdminClient>,
  restaurantSlug: string
) {
  const { data, error } = await supabase
    .from("restaurants")
    .select(
      "id, slug, name, is_active, is_open, accept_orders"
    )
    .eq("slug", restaurantSlug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

async function getActiveSession(
  supabase: ReturnType<typeof createAdminClient>,
  restaurantId: number,
  sessionId: number
) {
  const { data, error } = await supabase
    .from("table_sessions")
    .select(
      `
        id,
        restaurant_id,
        table_id,
        status,
        started_at,
        ended_at,
        group_code
      `
    )
    .eq("id", sessionId)
    .eq("restaurant_id", restaurantId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

/* --------------------------------
   GET SHARED CART
-------------------------------- */

export async function GET(
  request: Request
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const restaurantSlug =
      searchParams.get(
        "restaurantSlug"
      );

    const tableSessionId = Number(
      searchParams.get(
        "tableSessionId"
      )
    );

    if (
      !restaurantSlug ||
      !tableSessionId ||
      Number.isNaN(tableSessionId)
    ) {
      return NextResponse.json(
        {
          error:
            "Restaurant and table session are required.",
        },
        { status: 400 }
      );
    }

    const supabase =
      createAdminClient();

    /* Restaurant */

    const restaurant =
      await getRestaurant(
        supabase,
        restaurantSlug
      );

    if (!restaurant) {
      return NextResponse.json(
        {
          error:
            "Restaurant not found.",
        },
        { status: 404 }
      );
    }

    /* Session */

    const session =
      await getActiveSession(
        supabase,
        restaurant.id,
        tableSessionId
      );

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Active table session not found.",
        },
        { status: 404 }
      );
    }

    /* Cart */

    const { data: cartItems, error } =
      await supabase
        .from("table_session_items")
        .select(
          `
            id,
            table_session_id,
            product_id,
            variant_id,
            combo_id,
            quantity,
            unit_price,
            created_at,
            updated_at
          `
        )
        .eq(
          "table_session_id",
          session.id
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

    if (error) {
      return NextResponse.json(
        {
          error:
            "Unable to load shared cart.",
        },
        { status: 500 }
      );
    }

    if (!cartItems?.length) {
      return NextResponse.json({
        success: true,
        items: [],
        total: 0,
        session: {
          id: session.id,
          restaurantId:
            session.restaurant_id,
          tableId:
            session.table_id,
          groupCode:
            session.group_code,
        },
      });
    }

    /* --------------------------------
       LOAD PRODUCTS
    -------------------------------- */

    const productIds = [
      ...new Set(
        cartItems
          .map(
            (item) =>
              item.product_id
          )
          .filter(Boolean)
      ),
    ];

    const variantIds = [
      ...new Set(
        cartItems
          .map(
            (item) =>
              item.variant_id
          )
          .filter(Boolean)
      ),
    ];

    const [
      productsResult,
      variantsResult,
    ] = await Promise.all([
      productIds.length
        ? supabase
            .from("products")
            .select(
              `
                id,
                name,
                slug,
                image_url
              `
            )
            .in(
              "id",
              productIds
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),

      variantIds.length
        ? supabase
            .from("product_variants")
            .select(
              `
                id,
                name,
                image_url
              `
            )
            .in(
              "id",
              variantIds
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),
    ]);

    if (
      productsResult.error ||
      variantsResult.error
    ) {
      return NextResponse.json(
        {
          error:
            "Unable to load cart products.",
        },
        { status: 500 }
      );
    }

    const products =
      productsResult.data || [];

    const variants =
      variantsResult.data || [];

    const productMap =
      new Map(
        products.map((product) => [
          product.id,
          product,
        ])
      );

    const variantMap =
      new Map(
        variants.map((variant) => [
          variant.id,
          variant,
        ])
      );

    /* --------------------------------
       FORMAT CART
    -------------------------------- */

    const items = cartItems.map(
      (item) => {
        const product =
          productMap.get(
            item.product_id
          );

        const variant =
          item.variant_id
            ? variantMap.get(
                item.variant_id
              )
            : null;

        return {
          id: item.id,

          key: item.variant_id
            ? `${item.product_id}-${item.variant_id}`
            : `${item.product_id}-base`,

          productId:
            item.product_id,

          productSlug:
            product?.slug || "",

          name:
            product?.name ||
            "Unknown item",

          imageUrl:
            variant?.image_url ||
            product?.image_url ||
            null,

          variantId:
            item.variant_id,

          variantName:
            variant?.name ||
            null,

          quantity:
            Number(item.quantity),

          price:
            Number(item.unit_price),

          total:
            Number(item.unit_price) *
            Number(item.quantity),
        };
      }
    );

    const total = items.reduce(
      (sum, item) =>
        sum + item.total,
      0
    );

    return NextResponse.json({
      success: true,
      items,
      total,
      session: {
        id: session.id,
        restaurantId:
          session.restaurant_id,
        tableId:
          session.table_id,
        groupCode:
          session.group_code,
      },
    });
  } catch (error) {
    console.error(
      "GET TABLE CART ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal server error.",
      },
      { status: 500 }
    );
  }
}

/* --------------------------------
   ADD ITEM
-------------------------------- */

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as AddItemRequest;

    const {
      restaurantSlug,
      tableSessionId,
      productId,
      variantId,
      quantity,
    } = body;

    if (
      !restaurantSlug ||
      !tableSessionId ||
      !productId ||
      !quantity ||
      quantity < 1 ||
      quantity > 20
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid cart item data.",
        },
        { status: 400 }
      );
    }

    const supabase =
      createAdminClient();

    /* Restaurant */

    const restaurant =
      await getRestaurant(
        supabase,
        restaurantSlug
      );

    if (!restaurant) {
      return NextResponse.json(
        {
          error:
            "Restaurant not found.",
        },
        { status: 404 }
      );
    }

    if (
      !restaurant.is_active ||
      !restaurant.is_open ||
      !restaurant.accept_orders
    ) {
      return NextResponse.json(
        {
          error:
            "Restaurant is not accepting orders.",
        },
        { status: 400 }
      );
    }

    /* Session */

    const session =
      await getActiveSession(
        supabase,
        restaurant.id,
        tableSessionId
      );

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Active table session not found.",
        },
        { status: 404 }
      );
    }

    /* Product */

    const { data: product, error: productError } =
      await supabase
        .from("products")
        .select(
          `
            id,
            restaurant_id,
            price,
            is_active,
            is_available
          `
        )
        .eq(
          "id",
          productId
        )
        .eq(
          "restaurant_id",
          restaurant.id
        )
        .maybeSingle();

    if (
      productError ||
      !product
    ) {
      return NextResponse.json(
        {
          error:
            "Product not found.",
        },
        { status: 404 }
      );
    }

    if (
      !product.is_active ||
      !product.is_available
    ) {
      return NextResponse.json(
        {
          error:
            "Product is unavailable.",
        },
        { status: 400 }
      );
    }

    /* Variant */

    let unitPrice =
      Number(product.price);

    if (variantId !== null) {
      const {
        data: variant,
        error: variantError,
      } = await supabase
        .from("product_variants")
        .select(
          `
            id,
            product_id,
            price,
            is_active,
            is_available
          `
        )
        .eq(
          "id",
          variantId
        )
        .eq(
          "product_id",
          productId
        )
        .maybeSingle();

      if (
        variantError ||
        !variant
      ) {
        return NextResponse.json(
          {
            error:
              "Variant not found.",
          },
          { status: 404 }
        );
      }

      if (
        !variant.is_active ||
        !variant.is_available
      ) {
        return NextResponse.json(
          {
            error:
              "Variant is unavailable.",
          },
          { status: 400 }
        );
      }

      unitPrice =
        Number(variant.price);
    }

    /* Existing item */

    let query =
      supabase
        .from("table_session_items")
        .select(
          `
            id,
            quantity
          `
        )
        .eq(
          "table_session_id",
          session.id
        )
        .eq(
          "product_id",
          productId
        );

    query =
      variantId === null
        ? query.is(
            "variant_id",
            null
          )
        : query.eq(
            "variant_id",
            variantId
          );

    const {
      data: existingItem,
      error: existingError,
    } =
      await query.maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          error:
            "Unable to check cart.",
        },
        { status: 500 }
      );
    }

    if (existingItem) {
      const newQuantity =
        Number(existingItem.quantity) +
        quantity;

      if (newQuantity > 20) {
        return NextResponse.json(
          {
            error:
              "Maximum quantity is 20.",
          },
          { status: 400 }
        );
      }

      const {
        data: updatedItem,
        error,
      } = await supabase
        .from("table_session_items")
        .update({
          quantity:
            newQuantity,
          unit_price:
            unitPrice,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          existingItem.id
        )
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          {
            error:
              "Unable to update cart.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        action: "updated",
        item: updatedItem,
      });
    }

    /* New item */

    const {
      data: newItem,
      error,
    } = await supabase
      .from("table_session_items")
      .insert({
        table_session_id:
          session.id,
        product_id:
          productId,
        variant_id:
          variantId ?? null,
        combo_id: null,
        quantity,
        unit_price:
          unitPrice,
        created_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          error:
            "Unable to add item to cart.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action: "created",
      item: newItem,
    });
  } catch (error) {
    console.error(
      "POST TABLE CART ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal server error.",
      },
      { status: 500 }
    );
  }
}

/* --------------------------------
   UPDATE QUANTITY
-------------------------------- */

export async function PATCH(
  request: Request
) {
  try {
    const body =
      (await request.json()) as UpdateItemRequest;

    const {
      restaurantSlug,
      tableSessionId,
      itemId,
      quantity,
    } = body;

    if (
      !restaurantSlug ||
      !tableSessionId ||
      !itemId ||
      !Number.isInteger(quantity)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid update data.",
        },
        { status: 400 }
      );
    }

    const supabase =
      createAdminClient();

    const restaurant =
      await getRestaurant(
        supabase,
        restaurantSlug
      );

    if (!restaurant) {
      return NextResponse.json(
        {
          error:
            "Restaurant not found.",
        },
        { status: 404 }
      );
    }

    const session =
      await getActiveSession(
        supabase,
        restaurant.id,
        tableSessionId
      );

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Active table session not found.",
        },
        { status: 404 }
      );
    }

    if (quantity <= 0) {
      const {
        error,
      } = await supabase
        .from("table_session_items")
        .delete()
        .eq(
          "id",
          itemId
        )
        .eq(
          "table_session_id",
          session.id
        );

      if (error) {
        return NextResponse.json(
          {
            error:
              "Unable to remove item.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        action: "deleted",
      });
    }

    if (quantity > 20) {
      return NextResponse.json(
        {
          error:
            "Maximum quantity is 20.",
        },
        { status: 400 }
      );
    }

    const {
      data: updatedItem,
      error,
    } = await supabase
      .from("table_session_items")
      .update({
        quantity,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        itemId
      )
      .eq(
        "table_session_id",
        session.id
      )
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error:
            "Unable to update quantity.",
        },
        { status: 500 }
      );
    }

    if (!updatedItem) {
      return NextResponse.json(
        {
          error:
            "Cart item not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      action: "updated",
      item: updatedItem,
    });
  } catch (error) {
    console.error(
      "PATCH TABLE CART ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal server error.",
      },
      { status: 500 }
    );
  }
}

/* --------------------------------
   DELETE ITEM
-------------------------------- */

export async function DELETE(
  request: Request
) {
  try {
    const body =
      (await request.json()) as DeleteItemRequest;

    const {
      restaurantSlug,
      tableSessionId,
      itemId,
    } = body;

    if (
      !restaurantSlug ||
      !tableSessionId ||
      !itemId
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid delete data.",
        },
        { status: 400 }
      );
    }

    const supabase =
      createAdminClient();

    const restaurant =
      await getRestaurant(
        supabase,
        restaurantSlug
      );

    if (!restaurant) {
      return NextResponse.json(
        {
          error:
            "Restaurant not found.",
        },
        { status: 404 }
      );
    }

    const session =
      await getActiveSession(
        supabase,
        restaurant.id,
        tableSessionId
      );

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Active table session not found.",
        },
        { status: 404 }
      );
    }

    const {
      error,
    } = await supabase
      .from("table_session_items")
      .delete()
      .eq(
        "id",
        itemId
      )
      .eq(
        "table_session_id",
        session.id
      );

    if (error) {
      return NextResponse.json(
        {
          error:
            "Unable to remove item.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action: "deleted",
    });
  } catch (error) {
    console.error(
      "DELETE TABLE CART ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal server error.",
      },
      { status: 500 }
    );
  }
}