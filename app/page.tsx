"use client";

import { useState } from "react";
import { Toaster } from "sonner";
import { useVault } from "./hooks/useVault";
import { LoginView } from "./components/LoginView";
import { Sidebar } from "./components/Sidebar";
import { PropertiesSection } from "./components/PropertiesSection";
import { SharingSection } from "./components/SharingSection";
import { DevicesSection } from "./components/DevicesSection";
import { SettingsSection } from "./components/SettingsSection";

export default function HomePage() {
  const vault = useVault();
  const [activeSection, setActiveSection] = useState("properties");

  // Show login view if not signed in
  if (!vault.signedIn) {
    return (
      <>
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: "#141a26",
              color: "#f7f8fc",
              border: "1px solid #20293a"
            }
          }}
        />
        <LoginView
          onLogin={vault.login}
          isLoggingIn={vault.isLoggingIn}
          supportsPasskeys={vault.supportsPasskeys}
        />
      </>
    );
  }

  // Show loading state if missing key
  if (!vault.hasKey) {
    return (
      <>
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: "#141a26",
              color: "#f7f8fc",
              border: "1px solid #20293a"
            }
          }}
        />
        <main className="login-page">
          <div className="login-card">
            <h1>Missing Key</h1>
            <p className="login-desc">
              This device is authenticated but missing the entity key.
              Link it using an invite code from another device.
            </p>
            <DevicesSection
              generatedInvite={vault.generatedInvite}
              onGenerateInvite={vault.generateInvite}
              onLinkDevice={vault.linkDevice}
              disabled={vault.isBusy}
              isGenerating={vault.isGeneratingInvite}
              isLinking={vault.isLinking}
            />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#141a26",
            color: "#f7f8fc",
            border: "1px solid #20293a"
          }
        }}
      />

      <div className="app-layout">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          entityId={vault.entityId}
          connected={vault.connected}
          onLogout={vault.logout}
        />

        <main className="main-content">
          {activeSection === "properties" && (
            <PropertiesSection
              properties={vault.properties}
              onSetProperty={vault.setProperty}
              onDeleteProperty={vault.deleteProperty}
              disabled={vault.isBusy || !vault.connected}
            />
          )}

          {activeSection === "sharing" && (
            <SharingSection
              properties={vault.properties}
              shares={vault.shares}
              sharedData={vault.sharedData}
              onCreateShare={vault.createShareInvite}
              onAcceptShare={vault.acceptShare}
              onRemoveShare={vault.removeShare}
              generatedShare={vault.generatedShare}
              disabled={vault.isBusy}
              isCreating={vault.isCreatingShare}
              isAccepting={vault.isAcceptingShare}
            />
          )}

          {activeSection === "devices" && (
            <DevicesSection
              generatedInvite={vault.generatedInvite}
              onGenerateInvite={vault.generateInvite}
              onLinkDevice={vault.linkDevice}
              disabled={vault.isBusy}
              isGenerating={vault.isGeneratingInvite}
              isLinking={vault.isLinking}
            />
          )}

          {activeSection === "settings" && (
            <SettingsSection
              entityId={vault.entityId}
              onReset={vault.resetEverything}
              disabled={vault.isBusy}
              isResetting={vault.isResetting}
            />
          )}
        </main>
      </div>
    </>
  );
}
