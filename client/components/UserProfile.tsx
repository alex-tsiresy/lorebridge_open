"use client";

import { useUser } from "@clerk/nextjs";
import * as Separator from '@radix-ui/react-separator';
import { Slot } from '@radix-ui/react-slot';
import Image from 'next/image';
import { SubscriptionStatus } from './SubscriptionStatus';
import { SubscriptionButton } from './SubscriptionButton';

const Badge = ({ children, variant = "default", className = "" }: { 
  children: React.ReactNode; 
  variant?: "default" | "verified" | "primary"; 
  className?: string;
}) => {
  const baseClasses = "text-xs px-2 py-1 rounded-full font-medium";
  const variantClasses = {
    default: "bg-gray-100 text-gray-800",
    verified: "bg-green-100 text-green-800",
    primary: "custom-bg-accent-light custom-text-accent"
  };
  
  return (
    <Slot className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      <span>{children}</span>
    </Slot>
  );
};

export default function UserProfile() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <div className="mt-8 p-6 max-w-4xl mx-auto bg-white rounded-xl border border-gray-200 transition-all duration-300">
      {/* Header Section */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Your Profile</h3>
        <p className="text-gray-600 mt-1">Manage your account information and settings</p>
      </div>

      {/* Subscription Section */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h4>
        <SubscriptionStatus className="mb-4" />
        <SubscriptionButton variant="outline" />
      </div>

      <Separator.Root className="my-6 h-px bg-gray-200" />

      {/* Main Profile Info */}
      <div className="flex items-start space-x-6 mb-8">
        {user.imageUrl && (
          <Image
            src={user.imageUrl}
            alt="Profile"
            width={80}
            height={80}
            className="w-20 h-20 rounded-full object-cover border-4 custom-border-accent"
          />
        )}
        <div className="flex-1">
          <h4 className="text-xl font-semibold text-gray-900">
            {user.firstName} {user.lastName}
          </h4>
          <p className="text-gray-600 mt-1">@{user.username || user.id.slice(0, 8)}</p>
          <div className="mt-2 flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              Member since {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Recently"}
            </span>
            <span className="text-sm text-gray-500">
              Last updated {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "Recently"}
            </span>
          </div>
        </div>
      </div>

      {/* Contact Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Email Addresses */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2 custom-text-accent" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
            </svg>
            Email Addresses
          </h5>
          {user.emailAddresses && user.emailAddresses.length > 0 ? (
            <div className="space-y-2">
              {user.emailAddresses.map((email, index) => (
                <div key={email.id} className="flex items-center justify-between">
                  <span className="text-gray-700">{email.emailAddress}</span>
                  <div className="flex items-center space-x-2">
                    {email.verification?.status === "verified" && (
                      <Badge variant="verified">Verified</Badge>
                    )}
                    {index === 0 && (
                      <Badge variant="primary">Primary</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No email addresses</p>
          )}
        </div>

        {/* Phone Numbers */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
            </svg>
            Phone Numbers
          </h5>
          {user.phoneNumbers && user.phoneNumbers.length > 0 ? (
            <div className="space-y-2">
              {user.phoneNumbers.map((phone, index) => (
                <div key={phone.id} className="flex items-center justify-between">
                  <span className="text-gray-700">{phone.phoneNumber}</span>
                  <div className="flex items-center space-x-2">
                    {phone.verification?.status === "verified" && (
                      <Badge variant="verified">Verified</Badge>
                    )}
                    {index === 0 && (
                      <Badge variant="primary">Primary</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No phone numbers</p>
          )}
        </div>
      </div>

      {/* External Accounts */}
      {user.externalAccounts && user.externalAccounts.length > 0 && (
        <div className="mb-8">
          <div className="bg-gray-50 rounded-lg p-4">
            <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd"/>
              </svg>
              Connected Accounts
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {user.externalAccounts.map((account) => (
                <div key={account.id} className="bg-white rounded-lg p-3 flex items-center space-x-3 border border-gray-200">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 capitalize">
                      {account.provider}
                    </p>
                    <p className="text-sm text-gray-600">
                      {account.emailAddress || account.username || "Connected"}
                    </p>
                  </div>
                  {account.verification?.status === "verified" && (
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Metadata */}
      {(user.publicMetadata && Object.keys(user.publicMetadata).length > 0) && (
        <div className="mb-8">
          <h5 className="font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            Additional Information
          </h5>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(user.publicMetadata).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="font-medium text-gray-700 capitalize">
                    {key.replace(/_/g, ' ')}:
                  </span>
                  <span className="text-gray-600">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Account Status */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
          <svg className="w-5 h-5 mr-2 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          Account Status
        </h5>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {user.emailAddresses?.filter(email => email.verification?.status === "verified").length || 0}
            </div>
            <div className="text-sm text-gray-600">Verified Emails</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {user.phoneNumbers?.filter(phone => phone.verification?.status === "verified").length || 0}
            </div>
            <div className="text-sm text-gray-600">Verified Phones</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {user.externalAccounts?.length || 0}
            </div>
            <div className="text-sm text-gray-600">Connected Accounts</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {user.lastSignInAt ? Math.floor((Date.now() - new Date(user.lastSignInAt).getTime()) / (1000 * 60 * 60 * 24)) : "—"}
            </div>
            <div className="text-sm text-gray-600">Days Since Last Sign In</div>
          </div>
        </div>
      </div>

      <Separator.Root className="my-6 bg-gray-200 h-px" />

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Your profile information is managed through your account settings.
        </p>
        <div className="text-xs text-gray-500">
          User ID: {user.id}
        </div>
      </div>
    </div>
  );
} 