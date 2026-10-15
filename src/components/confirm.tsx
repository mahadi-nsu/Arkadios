"use client";
import { createContext, useContext, useState } from "react";
import * as Alert from "@radix-ui/react-alert-dialog";
import { Button } from "./ui/button";
type Request = {
  title: string;
  description: string;
  label?: string;
  danger?: boolean;
};
const Context = createContext<(r: Request) => Promise<boolean>>(
  async () => false,
);
export const useConfirm = () => useContext(Context);
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<
    (Request & { resolve: (v: boolean) => void }) | null
  >(null);
  return (
    <Context.Provider
      value={(r) => new Promise((resolve) => setRequest({ ...r, resolve }))}
    >
      {children}
      <Alert.Root
        open={!!request}
        onOpenChange={(open) => {
          if (!open) {
            request?.resolve(false);
            setRequest(null);
          }
        }}
      >
        <Alert.Portal>
          <Alert.Overlay className="dialog-overlay" />
          <Alert.Content className="dialog-content confirm-dialog">
            <div className="drawer-heading">
              <Alert.Title>{request?.title}</Alert.Title>
              <Alert.Description>{request?.description}</Alert.Description>
            </div>
            <div className="confirm-actions">
              <Alert.Cancel asChild>
                <Button variant="secondary">Cancel</Button>
              </Alert.Cancel>
              <Alert.Action asChild>
                <Button
                  variant={request?.danger ? "destructive" : "default"}
                  onClick={() => {
                    request?.resolve(true);
                    setRequest(null);
                  }}
                >
                  {request?.label ?? "Confirm"}
                </Button>
              </Alert.Action>
            </div>
          </Alert.Content>
        </Alert.Portal>
      </Alert.Root>
    </Context.Provider>
  );
}
