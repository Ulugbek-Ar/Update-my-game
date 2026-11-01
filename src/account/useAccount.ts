/** React hook'lari: akkaunt va bulutli saqlanish holatini kuzatish */
import { useSyncExternalStore } from "react";
import { account } from "./account";
import { cloud } from "./cloud";

export function useAccount() {
  return useSyncExternalStore(account.subscribe, account.getState, account.getState);
}

export function useCloud() {
  return useSyncExternalStore(cloud.subscribe, cloud.getView, cloud.getView);
}
