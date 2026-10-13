"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Customer } from "@/lib/customer-account";
import {
  commerceRequest,
  CommerceRequestError,
  type Address,
  type Cart,
} from "@/lib/web-commerce";

type CartState = {
  status: "loading" | "guest" | "ready" | "error";
  customer: Customer | null;
  cart: Cart | null;
  addresses: Address[];
};
const empty: CartState = {
  status: "loading",
  customer: null,
  cart: null,
  addresses: [],
};

/** Private state lives only in this mounted screen; the database owns the cart. */
export function useCustomerCart(withAddresses = true) {
  const [state, setState] = useState<CartState>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const current = useRef(state);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mutation = useRef(false);
  const mounted = useRef(true);

  const publish = useCallback((next: CartState) => {
    current.current = next;
    if (mounted.current) setState(next);
  }, []);

  const invalidate = useCallback(() => {
    generation.current += 1;
    controller.current?.abort();
    mutation.current = false;
    publish(empty);
    if (mounted.current) setBusy(false);
  }, [publish]);

  const refresh = useCallback(async () => {
    invalidate();
    if (mounted.current) setError(null);
    const requestGeneration = generation.current;
    const requestController = new AbortController();
    controller.current = requestController;
    const signal = requestController.signal;
    try {
      const { customer } = await commerceRequest<{ customer: Customer }>(
        "auth/session",
        { signal },
      );
      const [cartResponse, addressResponse] = await Promise.all([
        commerceRequest<{ cart: Cart }>("cart", { signal }),
        withAddresses
          ? commerceRequest<{ customerId: string; addresses: Address[] }>(
              "addresses",
              { signal },
            )
          : Promise.resolve({ customerId: customer.id, addresses: [] }),
      ]);
      if (
        signal.aborted ||
        generation.current !== requestGeneration ||
        !mounted.current
      )
        return;
      if (
        cartResponse.cart.customerId !== customer.id ||
        addressResponse.customerId !== customer.id
      ) {
        publish({ ...empty, status: "guest" });
        setError(new CommerceRequestError("SESSION_CHANGED", 401));
        return;
      }
      publish({
        status: "ready",
        customer,
        cart: cartResponse.cart,
        addresses: addressResponse.addresses,
      });
    } catch (cause) {
      if (
        signal.aborted ||
        generation.current !== requestGeneration ||
        !mounted.current
      )
        return;
      if (cause instanceof CommerceRequestError && cause.status === 401) {
        publish({ ...empty, status: "guest" });
      } else {
        publish({ ...empty, status: "error" });
        setError(cause);
      }
    }
  }, [invalidate, publish, withAddresses]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    function resume() {
      if (document.visibilityState === "visible") void refresh();
    }
    function visibility() {
      if (document.visibilityState === "hidden") invalidate();
      else resume();
    }
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("dosso-web-customer");
    if (channel) channel.onmessage = resume;
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("pagehide", invalidate);
    window.addEventListener("dosso-customer-session-changed", resume);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted.current = false;
      generation.current += 1;
      controller.current?.abort();
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("pagehide", invalidate);
      window.removeEventListener("dosso-customer-session-changed", resume);
      document.removeEventListener("visibilitychange", visibility);
      channel?.close();
    };
  }, [invalidate, refresh]);

  const mutate = useCallback(
    async (
      path: string,
      method: "POST" | "PUT" | "PATCH" | "DELETE",
      body: Record<string, unknown>,
    ) => {
      const snapshot = current.current;
      if (
        !snapshot.cart ||
        !snapshot.customer ||
        snapshot.status !== "ready" ||
        mutation.current
      )
        return false;
      mutation.current = true;
      setBusy(true);
      setError(null);
      const requestGeneration = generation.current;
      const requestController = new AbortController();
      controller.current = requestController;
      const signal = requestController.signal;
      try {
        // Check the active cookie owner before applying an action from this screen.
        const { customer } = await commerceRequest<{ customer: Customer }>(
          "auth/session",
          { signal },
        );
        if (signal.aborted || generation.current !== requestGeneration)
          return false;
        if (customer.id !== snapshot.customer.id) {
          await refresh();
          setError(new CommerceRequestError("SESSION_CHANGED", 401));
          return false;
        }
        const { cart } = await commerceRequest<{ cart: Cart }>(path, {
          method,
          body: { ...body, version: snapshot.cart.version },
          signal,
        });
        if (
          signal.aborted ||
          generation.current !== requestGeneration ||
          !mounted.current
        )
          return false;
        if (cart.customerId !== snapshot.customer.id) {
          await refresh();
          return false;
        }
        publish({ ...snapshot, cart });
        return true;
      } catch (cause) {
        if (
          signal.aborted ||
          generation.current !== requestGeneration ||
          !mounted.current
        )
          return false;
        if (
          cause instanceof CommerceRequestError &&
          [401, 404, 409].includes(cause.status)
        )
          await refresh();
        if (mounted.current) setError(cause);
        return false;
      } finally {
        if (generation.current === requestGeneration && mounted.current) {
          mutation.current = false;
          setBusy(false);
        }
      }
    },
    [publish, refresh],
  );

  return {
    ...state,
    busy,
    error,
    clearError: () => setError(null),
    refresh,
    mutate,
  };
}
