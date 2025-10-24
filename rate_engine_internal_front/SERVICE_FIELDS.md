# Service Fields Configuration

This document shows which fields are displayed for each service in the internal rate engine form.

## Service Breakdown

### 1. Drug Resistance
**Simplest service - fixed price**
- ✅ Property Category (residential/commercial)
- ✅ Discount
- ✅ Addons
- ❌ NO bedrooms, bathrooms, levels, or other property details

### 2. Pre Purchase
**Standard residential inspection**
- ✅ Bedrooms
- ✅ Bathrooms
- ✅ Property Category
- ✅ Levels
- ✅ Basement (dropdown)
- ✅ Discount
- ✅ Addons (including Granny Flat)

### 3. Pre Sales
**Same as Pre Purchase**
- ✅ Bedrooms
- ✅ Bathrooms
- ✅ Property Category
- ✅ Levels
- ✅ Basement (dropdown)
- ✅ Discount
- ✅ Addons (including Granny Flat)

### 4. Apartment Pre Settlement
**Simplified - no basement, always single level**
- ✅ Bedrooms
- ✅ Bathrooms
- ✅ Property Category
- ✅ Discount
- ✅ Addons (including Granny Flat)
- ❌ NO basement, NO levels (always 1)

### 5. New Construction Stages
**Stage-based pricing (1-6)**
- ✅ Stages (toggles: 1-6)
- ✅ Area (sq)
- ✅ Property Category
- ✅ Levels
- ✅ Discount
- ✅ Addons (including Granny Flat)
- ❌ NO bedrooms, bathrooms, basement

### 6. Pre Handover
**Flexible - house or apartment**
- ✅ Property Type (house/apartment)
- ✅ Property Category
- ✅ Bedrooms
- ✅ Bathrooms
- ✅ Area (sq)
- ✅ Levels
- ✅ Discount
- ✅ Addons (including Granny Flat)

### 7. Dilapidation
**Most comprehensive**
- ✅ Bedrooms
- ✅ Bathrooms
- ✅ Property Category
- ✅ Levels
- ✅ Basement (dropdown)
- ✅ Discount
- ✅ Addons (including Granny Flat & Swimming Pool)

### 8. Insurance Report
**Stage-based with damage estimation (1-3)**
- ✅ Stages (toggles: 1-3)
- ✅ Estimated Damage/Loss ($)
- ✅ Property Category
- ✅ Discount
- ✅ Addons
- ❌ NO bedrooms, bathrooms, levels

### 9. Defects Investigation
**Two-stage process (1-2)**
- ✅ Stages (toggles: 1-2)
- ✅ Property Category
- ✅ Discount
- ✅ Addons
- ❌ NO bedrooms, bathrooms, levels

### 10. Expert Witness Report
**Multi-hour stage-based (1-3)**
- ✅ Stages and Hours (inline layout)
  - Stage 1 checkbox + Number of Hours input (minimum 7)
  - Stage 2 checkbox + Number of Hours input
  - Stage 3 checkbox + Number of Hours input
- ✅ Property Category
- ✅ Discount
- ✅ Addons
- ❌ NO bedrooms, bathrooms, levels

## Available Addons (All Services)
- Shed/Garage/Carport Inspection
- Roof Void Inspection
- Express Report Delivery
- Pest Inspection
- Drug Residue
- Thermal Imaging & Moisture Meter
- Drone Roof Inspection
- Video
- Granny Flat
- Swimming Pool
- Out of Area Travel (per km)

## Field Behavior
- The form automatically shows/hides fields based on the selected service
- Basement is displayed as a Yes/No dropdown
- Granny Flat and Swimming Pool are now part of the Addons section (toggles)
- All addons are displayed as toggle switches in a 2-column layout
- Numeric fields have appropriate min/max constraints
- Stage fields are displayed as individual toggle checkboxes in a 3-column layout
- Levels field is a dropdown (Single/Double/Triple Storey)
- The form auto-calculates quotes in real-time (500ms debounce)

