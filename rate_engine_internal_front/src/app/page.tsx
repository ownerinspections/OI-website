"use client";

import { useState, useEffect } from "react";
import { calculateQuote } from "./actions";

// Stage mapping for new construction stages
const NEW_CONSTRUCTION_STAGE_NAMES: Record<number, string> = {
  1: "Bored Piers (Screw Piles)",
  2: "Slab Pre-Pour",
  3: "Frame Inspection",
  4: "Lock-Up (Pre-Plaster)",
  5: "Fixing including Waterproofing",
  6: "Completion (PCI) Pre-Handover",
};
import styles from "./page.module.css";

const SERVICES = [
  { value: "pre_purchase", label: "Pre Purchase" },
  { value: "pre_sales", label: "Pre Sales" },
  { value: "apartment_pre_settlement", label: "Apartment Pre Settlement" },
  { value: "new_construction_stages", label: "New Construction Stages" },
  { value: "dilapidation", label: "Dilapidation" },
  { value: "insurance_report", label: "Insurance Report" },
  { value: "defects_investigation", label: "Defects Investigation" },
  { value: "expert_witness_report", label: "Expert Witness Report" },
  { value: "pre_handover", label: "Pre Handover" },
  { value: "drug_resistance", label: "Drug Resistance" },
  { value: "building_and_pest", label: "Building and Pest" },
];

const ADDONS = [
  { key: "pest_inspection", label: "Pest Inspection" },
  { key: "drug_residue", label: "Drug Residue" },
  { key: "thermal_imaging_moisture_meter", label: "Thermal Imaging & Moisture Meter" },
  { key: "drone_roof_inspection", label: "Drone Roof Inspection" },
  { key: "video", label: "Video" },
  { key: "granny_flat", label: "Granny Flat" },
  { key: "swimming_pool", label: "Swimming Pool" },
];

export default function Home() {
  const [service, setService] = useState("pre_purchase");
  const [formData, setFormData] = useState<Record<string, any>>({
    bedrooms: 3,
    bathrooms: 2,
    property_category: "residential",
    property_type: "house",
    levels: 1,
    basement: false,
    discount: 0,
    area_sq: 30,
    stages: [1, 2, 3],
    estimated_damage_loss: 100000,
    number_of_hours_stage_1: 7,
    number_of_hours_stage_2: 0,
    number_of_hours_stage_3: 0,
    out_of_area_travel_surcharge_per_km: 0,
  });
  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const [emailGreeting, setEmailGreeting] = useState(
    process.env.NEXT_PUBLIC_EMAIL_GREETING || "Hi there,"
  );
  const [emailHeaderPhrase, setEmailHeaderPhrase] = useState(
    process.env.NEXT_PUBLIC_EMAIL_HEADER_PHRASE || "Thank you for your interest in our inspection services. Please review your customized quote below. To proceed, simply complete your payment and submit your booking details using the secure links provided."
  );
  const [emailNote, setEmailNote] = useState("");
  const [validDays, setValidDays] = useState(14);
  const [refundable, setRefundable] = useState("No");
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);

  const generateHTML = () => {
    if (!response) return "";

    const serviceLabel = SERVICES.find((s) => s.value === service)?.label || service;
    
    // Get booking URL for the selected service
    const bookingUrls: Record<string, string> = {
      pre_purchase: process.env.NEXT_PUBLIC_BOOKING_URL_PRE_PURCHASE || "",
      pre_sales: process.env.NEXT_PUBLIC_BOOKING_URL_PRE_SALES || "",
      apartment_pre_settlement: process.env.NEXT_PUBLIC_BOOKING_URL_APARTMENT_PRE_SETTLEMENT || "",
      new_construction_stages: process.env.NEXT_PUBLIC_BOOKING_URL_NEW_CONSTRUCTION_STAGES || "http://localhost:8030/steps/01-contact",
      dilapidation: process.env.NEXT_PUBLIC_BOOKING_URL_DILAPIDATION || "",
      insurance_report: process.env.NEXT_PUBLIC_BOOKING_URL_INSURANCE_REPORT || "",
      defects_investigation: process.env.NEXT_PUBLIC_BOOKING_URL_DEFECTS_INVESTIGATION || "",
      expert_witness_report: process.env.NEXT_PUBLIC_BOOKING_URL_EXPERT_WITNESS_REPORT || "",
      pre_handover: process.env.NEXT_PUBLIC_BOOKING_URL_PRE_HANDOVER || "",
      drug_resistance: process.env.NEXT_PUBLIC_BOOKING_URL_DRUG_RESISTANCE || "",
      building_and_pest: process.env.NEXT_PUBLIC_BOOKING_URL_BUILDING_PEST || "",
    };
    const bookingUrl = bookingUrls[service] || "";

    // Get registration links
    const registrationLinks = {
      nsw: process.env.NEXT_PUBLIC_REGISTRATION_LINK_NSW || "https://lh3.googleusercontent.com/d/1zkLgf43NETkHCnqTrYGJds5uFvbm6fle",
      vic: process.env.NEXT_PUBLIC_REGISTRATION_LINK_VIC || "https://lh3.googleusercontent.com/d/1h7cMG3g2kD09guscdKyBbmF_CjUBe0-c",
      qld: process.env.NEXT_PUBLIC_REGISTRATION_LINK_QLD || "https://lh3.googleusercontent.com/d/13KZZ2fh7kmGvZ-VPWIMl9m2ar2QyBlr7",
      asbc: process.env.NEXT_PUBLIC_REGISTRATION_LINK_ASBC || "https://lh3.googleusercontent.com/d/1nwf-2rjhLwp5ukl2g-bGSQGR5xHrahRD",
    };

    let html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
  <!--[if gte mso 9]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="format-detection" content="telephone=no" />
  <meta name="format-detection" content="date=no" />
  <meta name="format-detection" content="address=no" />
  <meta name="format-detection" content="email=no" />
  <title>Property Inspection Quote</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, span {
      font-family: Arial, Helvetica, sans-serif !important;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <!--[if mso | IE]>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px;">
          <tr>
            <td>
  <![endif]-->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb;">
    <tr>
      <td bgcolor="#0b487b" style="background-color: #0b487b; padding: 24px;">
        <!--[if gte mso 9]>
        <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:100px;">
          <v:fill type="gradient" color="#2c9bd6" color2="#0b487b" angle="135" />
          <v:textbox inset="0,0,0,0">
        <![endif]-->
        <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
          <tr>
            <td style="vertical-align: middle; width: auto;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#ffffff" style="background-color: #ffffff; padding: 8px 12px; border-radius: 6px;">
                    <img src="${process.env.NEXT_PUBLIC_LOGO_URL || "https://lh3.googleusercontent.com/d/1ONJw7Xq3CEsMcIR0XfT4-5p6PNdd0ehV"}" alt="Owner Inspections Logo" width="120" height="40" style="height: 40px; width: 120px; display: block; border: none; max-width: 100%;" />
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle; padding-left: 20px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff; font-family: Arial, Helvetica, sans-serif;">${serviceLabel} Quote</h1>
            </td>
          </tr>
        </table>
        <!--[if gte mso 9]>
          </v:textbox>
        </v:rect>
        <![endif]-->
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding: 24px;">
        <!-- Greeting Section -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px;">
          <tr>
            <td>
              <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #262626; font-family: Arial, Helvetica, sans-serif;">${emailGreeting}</p>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #595959; font-family: Arial, Helvetica, sans-serif;">${emailHeaderPhrase}</p>
            </td>
          </tr>
        </table>

        <!-- Registrations Section -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f5f5f5" style="background-color: #f5f5f5; margin-bottom: 24px; border-radius: 8px;">
          <tr>
            <td style="padding: 16px;">
              <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #262626; text-align: center; font-family: Arial, Helvetica, sans-serif;">Fully Licensed & Certified</h3>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center" style="padding: 4px 2px; width: 25%; vertical-align: top;">
              <a href="${registrationLinks.nsw}" target="_blank" style="text-decoration: none; display: block;">
                <img src="${registrationLinks.nsw}" alt="NSW Fair Trading" width="70" height="35" style="height: 35px; width: 70px; max-width: 100%; display: block; margin: 0 auto 6px auto; border: none;" />
                <p style="margin: 0; font-size: 9px; color: #595959; line-height: 1.3; text-align: center; font-family: Arial, Helvetica, sans-serif;">NSW Fair Trading:<br/><strong style="color: #262626;">366177C</strong></p>
              </a>
            </td>
            <td align="center" style="padding: 4px 2px; width: 25%; vertical-align: top;">
              <a href="${registrationLinks.vic}" target="_blank" style="text-decoration: none; display: block;">
                <img src="${registrationLinks.vic}" alt="VIC BPC" width="70" height="35" style="height: 35px; width: 70px; max-width: 100%; display: block; margin: 0 auto 6px auto; border: none;" />
                <p style="margin: 0; font-size: 9px; color: #595959; line-height: 1.3; text-align: center; font-family: Arial, Helvetica, sans-serif;">VIC BPC:<br/><strong style="color: #262626;">CDB-U53425</strong></p>
              </a>
            </td>
            <td align="center" style="padding: 4px 2px; width: 25%; vertical-align: top;">
              <a href="${registrationLinks.qld}" target="_blank" style="text-decoration: none; display: block;">
                <img src="${registrationLinks.qld}" alt="QLD QBCC" width="70" height="35" style="height: 35px; width: 70px; max-width: 100%; display: block; margin: 0 auto 6px auto; border: none;" />
                <p style="margin: 0; font-size: 9px; color: #595959; line-height: 1.3; text-align: center; font-family: Arial, Helvetica, sans-serif;">QLD QBCC:<br/><strong style="color: #262626;">15249792</strong></p>
              </a>
            </td>
            <td align="center" style="padding: 4px 2px; width: 25%; vertical-align: top;">
              <a href="${registrationLinks.asbc}" target="_blank" style="text-decoration: none; display: block;">
                <img src="${registrationLinks.asbc}" alt="ASBC SIP" width="70" height="35" style="height: 35px; width: 70px; max-width: 100%; display: block; margin: 0 auto 6px auto; border: none;" />
                <p style="margin: 0; font-size: 9px; color: #595959; line-height: 1.3; text-align: center; font-family: Arial, Helvetica, sans-serif;">ASBC SIP:<br/><strong style="color: #262626;">141</strong></p>
              </a>
            </td>
          </tr>
        </table>
            </td>
          </tr>
        </table>

        <!-- Trusted by Thousands Section -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f0f9ff" style="background-color: #f0f9ff; margin-bottom: 24px; border-radius: 8px;">
          <tr>
            <td align="center" style="padding: 20px;">
              <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #262626; font-family: Arial, Helvetica, sans-serif;">Join Thousands of Satisfied Customers</h3>
              <p style="margin: 0 0 12px 0; font-size: 24px; color: #f59e0b; letter-spacing: 2px;">★★★★★</p>
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #595959; font-family: Arial, Helvetica, sans-serif;">Read verified reviews from property owners just like you</p>
              
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 500px;">
          <!-- Row 1: NSW & VIC -->
          <tr>
            <td align="center" style="padding: 6px; width: 50%;">
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td bgcolor="#2c9bd6" style="background-color: #2c9bd6; padding: 12px 10px; border-radius: 6px; text-align: center;">
                    <a href="https://maps.app.goo.gl/yQaUkRmZDqmENLg4A" target="_blank" style="color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 600; display: block;">Google Reviews<br/>New South Wales</a>
                  </td>
                </tr>
              </table>
            </td>
            <td align="center" style="padding: 6px; width: 50%;">
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td bgcolor="#2c9bd6" style="background-color: #2c9bd6; padding: 12px 10px; border-radius: 6px; text-align: center;">
                    <a href="https://maps.app.goo.gl/n2oZnN1kGXNay5i39" target="_blank" style="color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 600; display: block;">Google Reviews<br/>Victoria</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Row 2: QLD & ProductReview -->
          <tr>
            <td align="center" style="padding: 6px; width: 50%;">
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td bgcolor="#2c9bd6" style="background-color: #2c9bd6; padding: 12px 10px; border-radius: 6px; text-align: center;">
                    <a href="https://maps.app.goo.gl/yqjGiJUsUt4DCZn88" target="_blank" style="color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 600; display: block;">Google Reviews<br/>Queensland</a>
                  </td>
                </tr>
              </table>
            </td>
            <td align="center" style="padding: 6px; width: 50%;">
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td bgcolor="#2c9bd6" style="background-color: #2c9bd6; padding: 12px 10px; border-radius: 6px; text-align: center;">
                    <a href="https://www.productreview.com.au/listings/owner-inspections" target="_blank" style="color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 600; display: block;">ProductReview<br/>Website</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Row 3: Channel 9 Videos -->
          <tr>
            <td align="center" style="padding: 6px; width: 50%;">
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td bgcolor="#0b487b" style="background-color: #0b487b; padding: 12px 10px; border-radius: 6px; text-align: center;">
                    <a href="https://www.youtube.com/watch?v=nZR-wwOJpYM&t=40s" target="_blank" style="color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 600; display: block;">Channel 9<br/>Video 1</a>
                  </td>
                </tr>
              </table>
            </td>
            <td align="center" style="padding: 6px; width: 50%;">
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td bgcolor="#0b487b" style="background-color: #0b487b; padding: 12px 10px; border-radius: 6px; text-align: center;">
                    <a href="https://www.youtube.com/watch?v=GOqbDiAAn9M&t=4s" target="_blank" style="color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 600; display: block;">Channel 9<br/>Video 2</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
          </td>
        </tr>
      </table>

      <!-- Sample Reports Section -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f0f9ff" style="background-color: #f0f9ff; margin-bottom: 24px; border-radius: 8px;">
        <tr>
          <td align="center" style="padding: 20px;">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #262626; font-family: Arial, Helvetica, sans-serif;">See Our Sample Reports</h3>
            <p style="margin: 0 0 16px 0; font-size: 13px; color: #595959; font-family: Arial, Helvetica, sans-serif;">View examples of our inspection reports to see the quality and detail of our work</p>
            
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td bgcolor="#2c9bd6" align="center" style="background-color: #2c9bd6; padding: 12px 24px; border-radius: 6px;">
                  <a href="https://app.spectora.com/home-inspectors/owner-inspections/sample_reports" target="_blank" style="color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; font-family: Arial, Helvetica, sans-serif; display: block;">View Sample Reports</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Quote Breakdown Header -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #0b487b;">
        <tr>
          <td align="center">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #0b487b; font-family: Arial, Helvetica, sans-serif;">Your Quote Breakdown</h2>
          </td>
        </tr>
      </table>
`;

    // Stage breakdown
    if (response.stage_prices && response.stage_prices.length > 0) {
      html += `
      <!-- Stage Breakdown -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f5f5f5" style="background-color: #f5f5f5; margin-bottom: 24px; border-radius: 6px;">
        <tr>
          <td style="padding: 16px;">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #262626; font-family: Arial, Helvetica, sans-serif;">Stage Breakdown</h3>
`;
      response.stage_prices.forEach((stage: any) => {
        html += `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding: 8px 0;">
          <tr>
                <td style="font-size: 14px; color: #595959; font-family: Arial, Helvetica, sans-serif;">Stage ${stage.stage}</td>
                <td align="right" style="font-size: 14px; font-weight: 600; color: #262626; font-family: Arial, Helvetica, sans-serif;">$${stage.price}</td>
          </tr>
        </table>
`;
      });
      html += `
          </td>
        </tr>
      </table>
`;
    }

    // Addons breakdown
    if (response.addons && response.addons.length > 0) {
      html += `
      <!-- Addons Breakdown -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f0f9ff" style="background-color: #f0f9ff; margin-bottom: 24px; border-radius: 6px;">
        <tr>
          <td style="padding: 16px;">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #262626; font-family: Arial, Helvetica, sans-serif;">Addons Breakdown</h3>
`;
      response.addons.forEach((addon: any) => {
        const addonName = addon.name
          .split("_")
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        html += `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding: 8px 0;">
          <tr>
                <td style="font-size: 14px; color: #595959; font-family: Arial, Helvetica, sans-serif;">${addonName}</td>
                <td align="right" style="font-size: 14px; font-weight: 600; color: #262626; font-family: Arial, Helvetica, sans-serif;">$${addon.price}</td>
          </tr>
        </table>
`;
      });
      html += `
          </td>
        </tr>
      </table>
`;
    }

    // Price breakdown
    html += `
      <!-- Price Breakdown -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px;">
        <tr>
          <td>
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #262626; font-family: Arial, Helvetica, sans-serif;">Price Breakdown</h3>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #d9d9d9;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="color: #595959; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">Inspection Amount</td>
                <td align="right" style="font-weight: 600; color: #262626; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">$${response.quote_price}</td>
          </tr>
        </table>
          </td>
        </tr>
`;

    if (response.gst !== undefined) {
      html += `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #d9d9d9;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="color: #595959; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">GST</td>
                <td align="right" style="font-weight: 600; color: #262626; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">$${response.gst}</td>
          </tr>
        </table>
          </td>
        </tr>
`;
    }

    if (response.price_including_gst !== undefined) {
      html += `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #d9d9d9;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="color: #595959; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">Total (Incl. GST)</td>
                <td align="right" style="font-weight: 600; color: #262626; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">$${response.price_including_gst}</td>
          </tr>
        </table>
          </td>
        </tr>
`;
    }

    if (response.discount > 0) {
      html += `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #d9d9d9;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="color: #595959; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">Discount</td>
                <td align="right" style="font-weight: 600; color: #ef4444; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">-$${response.discount}</td>
          </tr>
        </table>
          </td>
        </tr>
`;
    }

    if (response.payable_price !== undefined) {
      html += `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #d9d9d9;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="color: #595959; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">Payable Amount (Incl. GST)</td>
                <td align="right" style="font-weight: 600; color: #10b981; font-size: 18px; font-family: Arial, Helvetica, sans-serif;">$${response.payable_price}</td>
          </tr>
        </table>
          </td>
        </tr>
`;
    }

    html += `
      </table>
`;


    // Final payable amount highlight
    if (response.payable_price !== undefined) {
      html += `
      <!-- Total Amount Highlight -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#0b487b" style="background-color: #0b487b; margin-bottom: 24px; border-radius: 8px;">
        <tr>
          <td align="center" style="padding: 20px;">
            <!--[if gte mso 9]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:552px;">
              <v:fill type="gradient" color="#2c9bd6" color2="#0b487b" angle="135" />
              <v:textbox inset="0,20,0,20">
            <![endif]-->
            <div>
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #e0f2fe; font-family: Arial, Helvetica, sans-serif; letter-spacing: 1px; text-transform: uppercase;">TOTAL AMOUNT DUE (GST INCLUDED)</p>
              <p style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; font-family: Arial, Helvetica, sans-serif;">$${response.payable_price}</p>
            </div>
            <!--[if gte mso 9]>
              </v:textbox>
            </v:rect>
            <![endif]-->
          </td>
        </tr>
      </table>
`;
    }

    // Note section with terms
    const noteContent = [];
    noteContent.push(`• This quote is valid for ${validDays} days from the date of issue.`);
    noteContent.push(`• Refundable: ${refundable}`);
    if (emailNote && emailNote.trim()) {
      noteContent.push(`• ${emailNote}`);
    }

    html += `
      <!-- Important Notes -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#fffbeb" style="background-color: #fffbeb; margin-bottom: 24px; border-left: 4px solid #f59e0b; border-radius: 4px;">
        <tr>
          <td style="padding: 16px;">
            ${noteContent.map(note => `<p style="margin: 0 0 8px 0; font-size: 14px; line-height: 1.6; color: #595959; font-family: Arial, Helvetica, sans-serif;">${note}</p>`).join('')}
          </td>
        </tr>
      </table>

      <!-- Package Bonus Options Section (only for new construction stages) -->
      ${service === "new_construction_stages" ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f0f9ff" style="background-color: #f0f9ff; margin-bottom: 24px; border-radius: 8px; border: 2px solid #2c9bd6;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0b487b; text-align: center; font-family: Arial, Helvetica, sans-serif;">Package Bonus Options (For Minimum 5 Inspections)</h3>
            
            <!-- Option 1 -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#ffffff" style="background-color: #ffffff; margin-bottom: 16px; border: 1px solid #d9d9d9; border-radius: 6px;">
              <tr>
                <td style="padding: 16px;">
                  <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #262626; font-family: Arial, Helvetica, sans-serif;">Option 1: Discounted Package Price</h4>
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #595959; font-family: Arial, Helvetica, sans-serif;"><strong>Details:</strong> -$150 off the total package price</p>
                  <p style="margin: 0; font-size: 13px; color: #8c8c8c; font-family: Arial, Helvetica, sans-serif;"><strong>Terms & Conditions:</strong> Full payment in advance, Non-refundable</p>
                </td>
              </tr>
            </table>

            <!-- Option 2 -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#ffffff" style="background-color: #ffffff; margin-bottom: 16px; border: 2px solid #10b981; border-radius: 6px;">
              <tr>
                <td style="padding: 16px;">
                  <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #262626; font-family: Arial, Helvetica, sans-serif;">Option 2: Value-Added Bonuses <span style="background-color: #10b981; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; border: 1px solid #10b981;">*Most Popular*</span></h4>
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #595959; font-family: Arial, Helvetica, sans-serif;"><strong>Details:</strong></p>
                  <ul style="margin: 0 0 8px 0; padding-left: 20px; font-size: 14px; color: #595959; font-family: Arial, Helvetica, sans-serif;">
                    <li>FREE 1-2 minute video each stage</li>
                    <li>$50 reinspection credit per stage (valid for the same stage only)</li>
                    <li>FREE Thermal Camera at PCI</li>
                    <li>50% discount on using a drone (one-time use)</li>
                  </ul>
                  <p style="margin: 0; font-size: 13px; color: #8c8c8c; font-family: Arial, Helvetica, sans-serif;"><strong>Terms & Conditions:</strong> Full payment in advance, Non-refundable</p>
                </td>
              </tr>
            </table>

            <!-- Option 3 -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#ffffff" style="background-color: #ffffff; margin-bottom: 16px; border: 1px solid #d9d9d9; border-radius: 6px;">
              <tr>
                <td style="padding: 16px;">
                  <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #262626; font-family: Arial, Helvetica, sans-serif;">Option 3: Stage-by-Stage Payment Plan</h4>
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #595959; font-family: Arial, Helvetica, sans-serif;"><strong>Details:</strong> FREE 1-minute video each stage</p>
                  <p style="margin: 0; font-size: 13px; color: #8c8c8c; font-family: Arial, Helvetica, sans-serif;"><strong>Terms & Conditions:</strong> $500 deposit required (credited to final inspection), Stage-by-stage payments, $220 cancellation fee</p>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>
      ` : ''}

      <!-- Payment Options -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f0f9ff" style="background-color: #f0f9ff; margin-bottom: 24px; border-radius: 8px;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0b487b; text-align: center; font-family: Arial, Helvetica, sans-serif;">Ready to Proceed? Choose Your Payment Method</h3>
            
            <!-- Option 1: Card Payment -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#ffffff" style="background-color: #ffffff; margin-bottom: 20px; border: 1px solid #d9d9d9; border-radius: 6px;">
              <tr>
                <td style="padding: 16px;">
                  <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #262626; font-family: Arial, Helvetica, sans-serif;">Option 1: Pay Online with Card or Afterpay</h4>
                  <p style="margin: 0 0 12px 0; font-size: 13px; color: #595959; line-height: 1.5; font-family: Arial, Helvetica, sans-serif;">Fast, secure payment processing • Instant confirmation</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
                    <tr>
                      <td bgcolor="#2c9bd6" align="center" style="background-color: #2c9bd6; padding: 12px 24px; border-radius: 6px;">
                        <a href="https://buy.stripe.com/eVacPOfuL6735X28ww" style="color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; font-family: Arial, Helvetica, sans-serif; display: block;">Click Here to Pay Online</a>
              </td>
            </tr>
          </table>
                  <p style="margin: 8px 0 0 0; font-size: 12px; color: #f59e0b; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">⚠️ 3% surcharge applies</p>
                </td>
              </tr>
            </table>

        <!-- Option 2: PayID -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #d9d9d9; border-radius: 6px;">
              <tr>
                <td style="padding: 16px;">
                  <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #262626; font-family: Arial, Helvetica, sans-serif;">Option 2: Pay with PayID (Recommended)</h4>
                  <p style="margin: 0 0 12px 0; font-size: 13px; color: #595959; line-height: 1.5; font-family: Arial, Helvetica, sans-serif;">Direct bank transfer • No fees • Instant notification</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f5f5f5" style="background-color: #f5f5f5; margin-bottom: 12px; padding: 12px; border-radius: 4px;">
                    <tr>
                      <td>
                        <p style="margin: 0; font-size: 13px; color: #262626; font-family: Arial, Helvetica, sans-serif;"><strong>PayID Email:</strong></p>
                        <p style="margin: 4px 0 0 0; font-size: 14px; color: #0b487b; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">enquiries@ownerinspections.com.au</p>
              </td>
            </tr>
          </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
                    <tr>
                      <td bgcolor="#0b487b" align="center" style="background-color: #0b487b; padding: 10px 20px; border-radius: 6px;">
                        <a href="https://www.youtube.com/watch?v=xA27-v3zgkY" style="color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; font-family: Arial, Helvetica, sans-serif; display: block;">Learn How to Pay Using PayID</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 8px 0 0 0; font-size: 12px; color: #10b981; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">✓ No surcharge</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
`;

    // Booking section
    if (bookingUrl) {
      html += `
      <!-- Booking Section -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#0b487b" style="background-color: #0b487b; margin-bottom: 24px; border-radius: 8px;">
        <tr>
          <td align="center" style="padding: 20px;">
            <!--[if gte mso 9]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:552px;">
              <v:fill type="gradient" color="#2c9bd6" color2="#0b487b" angle="135" />
              <v:textbox inset="0,20,0,20">
            <![endif]-->
            <div>
              <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #ffffff; font-family: Arial, Helvetica, sans-serif;">Secure Your Inspection Date</h3>
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #e0f2fe; font-family: Arial, Helvetica, sans-serif;">After payment, select your preferred date and time for your ${serviceLabel} inspection</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td bgcolor="#ffffff" align="center" style="background-color: #ffffff; padding: 14px 32px; border-radius: 6px;">
                    <a href="${bookingUrl}" target="_blank" style="color: #0b487b; text-decoration: none; font-size: 16px; font-weight: 700; font-family: Arial, Helvetica, sans-serif; display: block;">Book Your Inspection Now</a>
                  </td>
                </tr>
              </table>
            </div>
            <!--[if gte mso 9]>
              </v:textbox>
            </v:rect>
            <![endif]-->
          </td>
        </tr>
      </table>
`;
    }

    html += `
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td bgcolor="#262626" style="background-color: #262626; padding: 32px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <!-- Contact Information -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <p style="margin: 0 0 6px 0; font-size: 14px; color: #d9d9d9; font-family: Arial, Helvetica, sans-serif;">
                <strong>Phone:</strong> <a href="tel:1300471805" style="color: #2c9bd6; text-decoration: none;">1300 471 805</a>
              </p>
              <p style="margin: 0 0 6px 0; font-size: 14px; color: #d9d9d9; font-family: Arial, Helvetica, sans-serif;">
                <strong>Email:</strong> <a href="mailto:enquiries@ownerinspections.com.au" style="color: #2c9bd6; text-decoration: none;">enquiries@ownerinspections.com.au</a>
              </p>
              <p style="margin: 0; font-size: 14px; color: #d9d9d9; font-family: Arial, Helvetica, sans-serif;">
                <strong>Website:</strong> <a href="https://ownerinspections.com.au/" style="color: #2c9bd6; text-decoration: none;">ownerinspections.com.au</a>
              </p>
            </td>
          </tr>
          
          <!-- Quick Links -->
          <tr>
            <td align="center" style="padding: 20px 0; border-top: 1px solid #595959;">
              <p style="margin: 0; font-size: 14px; color: #d9d9d9; font-family: Arial, Helvetica, sans-serif;">
                <a href="https://ownerinspections.com.au/about/our-team/" style="color: #2c9bd6; text-decoration: none;">Our Team</a> | 
                <a href="https://ownerinspections.com.au/vic/faqs/" style="color: #2c9bd6; text-decoration: none;">FAQs</a> | 
                <a href="https://ownerinspections.com.au/privacy-policy/" style="color: #2c9bd6; text-decoration: none;">Privacy Policy</a> | 
                <a href="https://ownerinspections.com.au/terms-and-conditions/" style="color: #2c9bd6; text-decoration: none;">Terms & Conditions</a>
              </p>
            </td>
          </tr>
          
          <!-- Copyright -->
          <tr>
            <td align="center" style="padding-top: 16px; border-top: 1px solid #595959;">
              <p style="margin: 0; font-size: 11px; color: #8c8c8c; font-family: Arial, Helvetica, sans-serif;">Generated on ${new Date().toLocaleString()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <!--[if mso | IE]>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <![endif]-->
</body>
</html>
`;

    return html;
  };

  // Function to get service note from environment variables
  const getServiceNoteFromEnv = (serviceName: string): string => {
    const serviceNoteMap: Record<string, string> = {
      pre_purchase: process.env.NEXT_PUBLIC_NOTE_PRE_PURCHASE || "",
      pre_sales: process.env.NEXT_PUBLIC_NOTE_PRE_SALES || "",
      apartment_pre_settlement: process.env.NEXT_PUBLIC_NOTE_APARTMENT_PRE_SETTLEMENT || "",
      new_construction_stages: process.env.NEXT_PUBLIC_NOTE_NEW_CONSTRUCTION_STAGES || "",
      dilapidation: process.env.NEXT_PUBLIC_NOTE_DILAPIDATION || "",
      insurance_report: process.env.NEXT_PUBLIC_NOTE_INSURANCE_REPORT || "",
      defects_investigation: process.env.NEXT_PUBLIC_NOTE_DEFECTS_INVESTIGATION || "",
      expert_witness_report: process.env.NEXT_PUBLIC_NOTE_EXPERT_WITNESS_REPORT || "",
      pre_handover: process.env.NEXT_PUBLIC_NOTE_PRE_HANDOVER || "",
      drug_resistance: process.env.NEXT_PUBLIC_NOTE_DRUG_RESISTANCE || "",
      building_and_pest: process.env.NEXT_PUBLIC_NOTE_BUILDING_AND_PEST || ""
    };
    
    return serviceNoteMap[serviceName] || process.env.NEXT_PUBLIC_DEFAULT_NOTE || "";
  };

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
    // Load initial service note
    const serviceNote = getServiceNoteFromEnv(service);
    setEmailNote(serviceNote);
  }, []);

  // Auto-calculate on form change
  useEffect(() => {
    if (!mounted) return;
    
    const timer = setTimeout(() => {
      handleCalculate();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, service, JSON.stringify(formData), JSON.stringify(addons)]);

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);

    const payload = {
      service,
      ...formData,
      ...addons,
      // Map granny_flat and swimming_pool from addons to formData for API
      granny_flat: addons.granny_flat || false,
      swimming_pool: addons.swimming_pool || false,
      // Apartment pre settlement always has 1 level
      ...(service === "apartment_pre_settlement" && { levels: 1 }),
    };

    const result = await calculateQuote(payload);

    if (result.success) {
      setResponse(result.data);
      setError(null);
    } else {
      setError(result.error || "Calculation failed");
      setResponse(null);
    }
    setLoading(false);
  };

  const handleInputChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddonToggle = (key: string) => {
    setAddons((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleShowTemplate = () => {
    const html = generateHTML();
    if (!html) return;

    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
    }
  };

  const handleCopySubject = async () => {
    const serviceLabel = SERVICES.find((s) => s.value === service)?.label || service;
    const subject = `${serviceLabel} Inspection Quote`;

    try {
      await navigator.clipboard.writeText(subject);
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
    } catch (err) {
      console.error("Failed to copy subject:", err);
    }
  };

  const handleCopyResponse = async () => {
    if (!response) return;

    const html = generateHTML();
    const serviceLabel = SERVICES.find((s) => s.value === service)?.label || service;

    // Plain text version
    let text = `Service: ${serviceLabel}\n${"=".repeat(50)}\n\n`;
    
    if (response.stage_prices && response.stage_prices.length > 0) {
      text += "Stage Breakdown:\n";
      response.stage_prices.forEach((stage: any) => {
        text += `  Stage ${stage.stage}: $${stage.price}\n`;
      });
      text += "\n";
    }

    if (response.addons && response.addons.length > 0) {
      text += "Addons Breakdown:\n";
      response.addons.forEach((addon: any) => {
        const addonName = addon.name
          .split("_")
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        text += `  ${addonName}: $${addon.price}\n`;
      });
      text += "\n";
    }

    text += "Price Breakdown:\n";
    text += `  Inspection Amount: $${response.quote_price}\n`;
    
    if (response.gst !== undefined) {
      text += `  GST: $${response.gst}\n`;
    }
    
    if (response.price_including_gst !== undefined) {
      text += `  Price Including GST: $${response.price_including_gst}\n`;
    }
    
    if (response.discount > 0) {
      text += `  Discount: -$${response.discount}\n`;
    }
    
    if (response.payable_price !== undefined) {
      text += `\n  PAYABLE AMOUNT: $${response.payable_price}\n`;
    }

    try {
      // Copy both HTML and plain text
      const blob = new Blob([html], { type: "text/html" });
      const textBlob = new Blob([text], { type: "text/plain" });
      
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blob,
          "text/plain": textBlob,
        }),
      ]);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      // Fallback to plain text
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error("Fallback failed:", e);
      }
    }
  };

  // Reset stages when service changes
  const handleServiceChange = (newService: string) => {
    setService(newService);
    
    // Set default stages based on service
    if (newService === "new_construction_stages" || newService === "insurance_report" || newService === "expert_witness_report") {
      setFormData((prev) => ({ ...prev, stages: [1, 2, 3] }));
    } else if (newService === "defects_investigation") {
      setFormData((prev) => ({ ...prev, stages: [1, 2] }));
    } else {
      setFormData((prev) => ({ ...prev, stages: [1] }));
    }

    // Load service-specific note from environment variable
    const serviceNote = getServiceNoteFromEnv(newService);
    setEmailNote(serviceNote);
  };

  const getFieldsForService = () => {
    switch (service) {
      case "drug_resistance":
        // Only property_category and discount (no bedrooms, bathrooms, levels, etc.)
        return ["property_category", "discount"];
      
      case "pre_purchase":
      case "pre_sales":
        // bedrooms, bathrooms, property_category, levels, basement, discount
        return ["bedrooms", "bathrooms", "property_category", "levels", "basement", "discount"];
      
      case "apartment_pre_settlement":
        // bedrooms, bathrooms, property_category, discount (levels always 1)
        return ["bedrooms", "bathrooms", "property_category", "discount"];
      
      case "new_construction_stages":
        // stages (1-6), area_sq, property_category, levels, discount
        return ["stages_1_6", "area_sq", "property_category", "levels", "discount"];
      
      case "pre_handover":
        // Fields depend on property_type
        const propertyType = formData.property_type || "house";
        if (propertyType === "apartment") {
          // Apartment: bedrooms, bathrooms, property_category, discount
          return ["property_type", "property_category", "bedrooms", "bathrooms", "discount"];
        } else {
          // House: area_sq, levels, property_category, discount (granny_flat is in addons)
          return ["property_type", "property_category", "area_sq", "levels", "discount"];
        }
      
      case "dilapidation":
        // bedrooms, bathrooms, property_category, levels, basement, discount
        return ["bedrooms", "bathrooms", "property_category", "levels", "basement", "discount"];
      
      case "building_and_pest":
        // bedrooms, bathrooms, property_category, levels, basement, discount (granny_flat is in addons)
        return ["bedrooms", "bathrooms", "property_category", "levels", "basement", "discount"];
      
      case "insurance_report":
        // stages (1-3), estimated_damage_loss, property_category, discount
        return ["stages_1_3", "estimated_damage_loss", "property_category", "discount"];
      
      case "defects_investigation":
        // stages (1-2), property_category, discount
        return ["stages_1_2", "property_category", "discount"];
      
      case "expert_witness_report":
        // stages (1-3) with inline hours, property_category, discount
        return ["stages_1_3", "property_category", "discount"];
      
      default:
        return ["property_category", "discount"];
    }
  };

  const fields = getFieldsForService();

  if (!mounted) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.formSection}>
          <div className={styles.card}>
            <div className={styles.twoColumn}>
              {fields.includes("property_category") && (
                <div className={styles.formGroup}>
                  <label>Property Category</label>
                  <select
                    value={formData.property_category}
                    onChange={(e) => handleInputChange("property_category", e.target.value)}
                    className={styles.select}
                  >
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
              )}

              <div className={styles.formGroup}>
                <label>Service Type</label>
                <select
                  value={service}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className={styles.select}
                >
                  {SERVICES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dynamic Fields */}
            {fields.includes("property_type") && (
              <div className={styles.formGroup}>
                <label>Property Type</label>
                <select
                  value={formData.property_type || "house"}
                  onChange={(e) => handleInputChange("property_type", e.target.value)}
                  className={styles.select}
                >
                  <option value="house">House</option>
                  <option value="apartment">Apartment</option>
                </select>
              </div>
            )}

            {(fields.includes("bedrooms") || fields.includes("bathrooms")) && (
              <div className={styles.twoColumn}>
                {fields.includes("bedrooms") && (
                  <div className={styles.formGroup}>
                    <label>Bedrooms</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.bedrooms}
                      onChange={(e) => handleInputChange("bedrooms", parseInt(e.target.value) || 0)}
                      className={styles.input}
                    />
                  </div>
                )}

                {fields.includes("bathrooms") && (
                  <div className={styles.formGroup}>
                    <label>Bathrooms</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.bathrooms}
                      onChange={(e) => handleInputChange("bathrooms", parseInt(e.target.value) || 0)}
                      className={styles.input}
                    />
                  </div>
                )}
              </div>
            )}

            {(fields.includes("levels") || fields.includes("basement") || fields.includes("area_sq")) && (
              <div className={styles.twoColumn}>
                {fields.includes("levels") && (
                  <div className={styles.formGroup}>
                    <label>Levels</label>
                    <select
                      value={formData.levels}
                      onChange={(e) => handleInputChange("levels", parseInt(e.target.value))}
                      className={styles.select}
                    >
                      <option value="1">Single Storey</option>
                      <option value="2">Double Storey</option>
                      <option value="3">Triple Storey</option>
                    </select>
                  </div>
                )}

                {fields.includes("basement") && (
                  <div className={styles.formGroup}>
                    <label>Basement</label>
                    <select
                      value={formData.basement ? "yes" : "no"}
                      onChange={(e) => handleInputChange("basement", e.target.value === "yes")}
                      className={styles.select}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                )}

                {fields.includes("area_sq") && !fields.includes("basement") && (
                  <div className={styles.formGroup}>
                    <label>Area (sq)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.area_sq}
                      onChange={(e) => handleInputChange("area_sq", parseInt(e.target.value) || 0)}
                      className={styles.input}
                    />
                  </div>
                )}
              </div>
            )}

            {fields.includes("area_sq") && fields.includes("basement") && (
              <div className={styles.formGroup}>
                <label>Area (sq)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.area_sq}
                  onChange={(e) => handleInputChange("area_sq", parseInt(e.target.value) || 0)}
                  className={styles.input}
                />
              </div>
            )}

            {fields.includes("stages_1_6") && (
              <div className={styles.formGroup}>
                <label>Stages</label>
                <div className={styles.twoColumnStages}>
                  {[1, 2, 3, 4, 5, 6].map((stage) => (
                    <div key={stage} className={styles.toggleItem}>
                      <label>
                        <input
                          type="checkbox"
                          checked={(formData.stages || []).includes(stage)}
                          onChange={(e) => {
                            const currentStages = formData.stages || [];
                            const newStages = e.target.checked
                              ? [...currentStages, stage].sort((a, b) => a - b)
                              : currentStages.filter((s: number) => s !== stage);
                            handleInputChange("stages", newStages);
                          }}
                        />
                        <span>{stage}: {NEW_CONSTRUCTION_STAGE_NAMES[stage]}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expert Witness Report - Stages with Hours inline */}
            {service === "expert_witness_report" && fields.includes("stages_1_3") && (
              <div className={styles.formGroup}>
                <label>Stages and Hours</label>
                {[1, 2, 3].map((stage) => (
                  <div key={stage} className={styles.twoColumn} style={{ alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div className={styles.toggleItem}>
                      <label>
                        <input
                          type="checkbox"
                          checked={(formData.stages || []).includes(stage)}
                          onChange={(e) => {
                            const currentStages = formData.stages || [];
                            const newStages = e.target.checked
                              ? [...currentStages, stage].sort((a, b) => a - b)
                              : currentStages.filter((s: number) => s !== stage);
                            handleInputChange("stages", newStages);
                          }}
                        />
                        <span>Stage {stage}</span>
                      </label>
                    </div>
                    <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.875rem' }}>
                        Number of Hours {stage === 1 ? '(min 7)' : ''}
                      </label>
                      <input
                        type="number"
                        min={stage === 1 ? "7" : "0"}
                        value={formData[`number_of_hours_stage_${stage}`] || (stage === 1 ? 7 : 0)}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          handleInputChange(
                            `number_of_hours_stage_${stage}`,
                            stage === 1 ? Math.max(7, value) : value
                          );
                        }}
                        className={styles.input}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Other services with stages (non-expert witness) */}
            {service !== "expert_witness_report" && fields.includes("stages_1_3") && (
              <div className={styles.formGroup}>
                <label>Stages</label>
                <div className={styles.threeColumn}>
                  {[1, 2, 3].map((stage) => (
                    <div key={stage} className={styles.toggleItem}>
                      <label>
                        <input
                          type="checkbox"
                          checked={(formData.stages || []).includes(stage)}
                          onChange={(e) => {
                            const currentStages = formData.stages || [];
                            const newStages = e.target.checked
                              ? [...currentStages, stage].sort((a, b) => a - b)
                              : currentStages.filter((s: number) => s !== stage);
                            handleInputChange("stages", newStages);
                          }}
                        />
                        <span>Stage {stage}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fields.includes("stages_1_2") && (
              <div className={styles.formGroup}>
                <label>Stages</label>
                <div className={styles.threeColumn}>
                  {[1, 2].map((stage) => (
                    <div key={stage} className={styles.toggleItem}>
                      <label>
                        <input
                          type="checkbox"
                          checked={(formData.stages || []).includes(stage)}
                          onChange={(e) => {
                            const currentStages = formData.stages || [];
                            const newStages = e.target.checked
                              ? [...currentStages, stage].sort((a, b) => a - b)
                              : currentStages.filter((s: number) => s !== stage);
                            handleInputChange("stages", newStages);
                          }}
                        />
                        <span>Stage {stage}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fields.includes("estimated_damage_loss") && (
              <div className={styles.formGroup}>
                <label>Estimated Damage/Loss ($)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.estimated_damage_loss || 100000}
                  onChange={(e) => handleInputChange("estimated_damage_loss", parseInt(e.target.value) || 0)}
                  className={styles.input}
                />
              </div>
            )}

            {/* Addons */}
            <div className={styles.toggleSection}>
              <h3>Addons</h3>
              <div className={styles.twoColumn}>
                {ADDONS.map((addon) => (
                  <div key={addon.key} className={styles.toggleItem}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!addons[addon.key]}
                        onChange={() => handleAddonToggle(addon.key)}
                      />
                      <span>{addon.label}</span>
                    </label>
                  </div>
                ))}
              </div>

              <div className={styles.twoColumn}>
                <div className={styles.formGroup}>
                  <label>Out of Area Travel (km)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.out_of_area_travel_surcharge_per_km || 0}
                    onChange={(e) =>
                      handleInputChange("out_of_area_travel_surcharge_per_km", parseInt(e.target.value) || 0)
                    }
                    className={styles.input}
                  />
                </div>

                {fields.includes("discount") && (
                  <div className={styles.formGroup}>
                    <label>Discount ($)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.discount}
                      onChange={(e) => handleInputChange("discount", parseInt(e.target.value) || 0)}
                      className={styles.input}
                    />
                  </div>
                )}
              </div>

              {/* Email Template Customization */}
              <div className={styles.toggleSection}>
                <h3>Email Template</h3>
                <div className={styles.formGroup}>
                  <label>Greeting</label>
                  <input
                    type="text"
                    value={emailGreeting}
                    onChange={(e) => setEmailGreeting(e.target.value)}
                    className={styles.input}
                    placeholder="Hi there,"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Header Message</label>
                  <textarea
                    value={emailHeaderPhrase}
                    onChange={(e) => setEmailHeaderPhrase(e.target.value)}
                    className={styles.textarea}
                    rows={4}
                    placeholder="As discussed, please find your property inspection quote below..."
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Note (Optional)</label>
                  <textarea
                    value={emailNote}
                    onChange={(e) => setEmailNote(e.target.value)}
                    className={styles.textarea}
                    rows={3}
                    placeholder="Add any additional notes or important information..."
                  />
                </div>
                <div className={styles.twoColumn}>
                  <div className={styles.formGroup}>
                    <label>Quote Valid For (Days)</label>
                    <input
                      type="number"
                      min="1"
                      value={validDays}
                      onChange={(e) => setValidDays(parseInt(e.target.value) || 14)}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Refundable</label>
                    <select
                      value={refundable}
                      onChange={(e) => setRefundable(e.target.value)}
                      className={styles.select}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.responseSection}>
          <div className={styles.card}>
            {response && !error && !loading && (
              <div className={styles.buttonGroup}>
                <button 
                  onClick={handleCopyResponse}
                  className={styles.copyButton}
                  title="Copy template"
                >
                  {copied ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      Copy Template
                    </>
                  )}
                </button>
                <button 
                  onClick={handleShowTemplate}
                  className={styles.showButton}
                  title="Show template"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  Show Template
                </button>
                <button 
                  onClick={handleCopySubject}
                  className={styles.copyButton}
                  title="Copy subject line"
                >
                  {copiedSubject ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      Copy Subject
                    </>
                  )}
                </button>
              </div>
            )}

            {loading && <div className={styles.loading}>Calculating...</div>}

            {error && (
              <div className={styles.error}>
                <strong>Error:</strong> {error}
                <div style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.9 }}>
                  <p>Make sure the rate engine API is running:</p>
                  <code style={{ display: 'block', marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}>
                    cd rate_engine_internal && uvicorn app:app --reload --port 8020
                  </code>
                </div>
              </div>
            )}

            {response && !error && (
              <div className={styles.response}>
                {/* 1. Stage Breakdown (if service has stages) */}
                {response.stage_prices && response.stage_prices.length > 0 && (
                  <div className={styles.stages}>
                    <h4>Stage Breakdown</h4>
                    {response.stage_prices.map((stage: any) => (
                      <div key={stage.stage} className={styles.stageRow}>
                        <span>Stage {stage.stage}</span>
                        <span>${stage.price}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. Addons Breakdown */}
                {response.addons && response.addons.length > 0 && (
                  <div className={styles.addonsBreakdown}>
                    <h4>Addons Breakdown</h4>
                    {response.addons.map((addon: any, idx: number) => (
                      <div key={idx} className={styles.addonRow}>
                        <span>
                          {addon.name
                            .split("_")
                            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(" ")}
                        </span>
                        <span>${addon.price}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. Price Breakdown */}
                <div className={styles.priceBreakdown}>
                  <h4>Price Breakdown</h4>
                </div>

                <div className={styles.priceRow}>
                  <span>Inspection Amount</span>
                  <span>${response.quote_price}</span>
                </div>

                {response.gst !== undefined && (
                  <div className={styles.priceRow}>
                    <span>GST</span>
                    <span>${response.gst}</span>
                  </div>
                )}

                {response.price_including_gst !== undefined && (
                  <div className={styles.priceRow}>
                    <span>Total (Incl. GST)</span>
                    <span>${response.price_including_gst}</span>
                  </div>
                )}

                {response.discount > 0 && (
                  <div className={styles.priceRow}>
                    <span>Discount</span>
                    <span className={styles.discount}>-${response.discount}</span>
                  </div>
                )}

                {response.payable_price !== undefined && (
                  <div className={styles.priceRow}>
                    <span>Payable Amount (Incl. GST)</span>
                    <span className={styles.final}>${response.payable_price}</span>
                  </div>
                )}

                {/* 4. Payable Amount (blue button/box) */}
                {response.payable_price !== undefined && (
                  <div className={styles.priceMain}>
                    <div className={styles.priceLabel}>Payable Amount (Incl. GST)</div>
                    <div className={styles.priceValue}>${response.payable_price}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

