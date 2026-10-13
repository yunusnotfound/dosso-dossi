"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { commerceRequest, CommerceRequestError } from "@/lib/web-commerce";
import type { Customer } from "@/lib/customer-account";

type PrivateResponse = { customerId: string };
type PrivateState<T> = {
  status: "loading" | "ready" | "guest" | "error";
  customer: Customer | null;
  data: T | null;
};

export function useCustomerOrders<T extends PrivateResponse>(path: string) {
  const blank: PrivateState<T> = {
    status: "loading",
    customer: null,
    data: null,
  };
  const [state, setState] = useState<PrivateState<T>>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const current = useRef(state);
  const epoch = useRef(0);
  const pending = useRef(false);
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const publish = useCallback((next: PrivateState<T>) => {
    current.current = next;
    if (mounted.current) setState(next);
  }, []);
  const invalidate = useCallback(() => {
    epoch.current++;
    controller.current?.abort();
    pending.current = false;
    publish({ status: "loading", customer: null, data: null });
    if (mounted.current) setBusy(false);
  }, [publish]);
  const refresh = useCallback(async () => {
    invalidate();
    setError(null);
    const generation = epoch.current;
    const control = new AbortController();
    controller.current = control;
    try {
      const { customer } = await commerceRequest<{ customer: Customer }>(
        "auth/session",
        { signal: control.signal },
      );
      const data = await commerceRequest<T>(path, { signal: control.signal });
      if (
        control.signal.aborted ||
        generation !== epoch.current ||
        !mounted.current
      )
        return;
      if (data.customerId !== customer.id)
        throw new CommerceRequestError("SESSION_CHANGED", 401);
      publish({ status: "ready", customer, data });
    } catch (cause) {
      if (
        control.signal.aborted ||
        generation !== epoch.current ||
        !mounted.current
      )
        return;
      publish({
        status:
          cause instanceof CommerceRequestError && cause.status === 401
            ? "guest"
            : "error",
        customer: null,
        data: null,
      });
      setError(cause);
    }
  }, [invalidate, path, publish]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const resume = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") invalidate();
      else resume();
    };
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
      epoch.current++;
      controller.current?.abort();
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("pagehide", invalidate);
      window.removeEventListener("dosso-customer-session-changed", resume);
      document.removeEventListener("visibilitychange", visibility);
      channel?.close();
    };
  }, [refresh, invalidate]);

  const mutate = useCallback(
    async <R extends PrivateResponse>(
      endpoint: string,
      body: Record<string, unknown>,
    ): Promise<R | null> => {
      const snapshot = current.current;
      if (!snapshot.customer || snapshot.status !== "ready" || pending.current)
        return null;
      pending.current = true;
      setBusy(true);
      setError(null);
      const generation = epoch.current;
      const control = new AbortController();
      controller.current = control;
      try {
        const { customer } = await commerceRequest<{ customer: Customer }>(
          "auth/session",
          { signal: control.signal },
        );
        if (control.signal.aborted || generation !== epoch.current) return null;
        if (customer.id !== snapshot.customer.id)
          throw new CommerceRequestError("SESSION_CHANGED", 401);
        const result = await commerceRequest<R>(endpoint, {
          method: "POST",
          body,
          signal: control.signal,
        });
        if (
          control.signal.aborted ||
          generation !== epoch.current ||
          !mounted.current
        )
          return null;
        if (result.customerId !== customer.id)
          throw new CommerceRequestError("SESSION_CHANGED", 401);
        return result;
      } catch (cause) {
        if (
          control.signal.aborted ||
          generation !== epoch.current ||
          !mounted.current
        )
          return null;
        if (
          cause instanceof CommerceRequestError &&
          [401, 404, 409].includes(cause.status)
        )
          await refresh();
        if (mounted.current) setError(cause);
        return null;
      } finally {
        if (generation === epoch.current && mounted.current) {
          pending.current = false;
          setBusy(false);
        }
      }
    },
    [refresh],
  );
  return { ...state, busy, error, setError, refresh, mutate };
}
