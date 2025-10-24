# Directus Email Templates

This directory contains custom email templates for Directus using LiquidJS.

## Available Templates

### Base Template
- **File**: `base.liquid`
- **Purpose**: Main layout template with header, footer, and styling
- **Features**:
  - Responsive design
  - Brand colors applied (#0b487b, #2c9bd6, etc.)
  - Inter font family
  - Pre-styled components (buttons, alerts, links)

### Welcome Email
- **Template Name**: `welcome-email`
- **File**: `welcome-email.liquid`
- **Variables**:
  - `firstname` (optional): User's first name
  - Default project variables (`projectName`, `projectUrl`, `projectLogo`, `projectColor`)

### Booking Confirmation
- **Template Name**: `booking-confirmation`
- **File**: `booking-confirmation.liquid`
- **Variables**:
  - `firstname` (optional): User's first name
  - `booking_id`: Booking reference number
  - `service_name`: Name of the inspection service
  - `booking_date`: Date and time of booking
  - `property_address`: Property address
  - `total_amount`: Total cost

### Password Reset
- **Template Name**: `password-reset`
- **File**: `password-reset.liquid`
- **Variables**:
  - `firstname` (optional): User's first name
  - `reset_url`: Password reset link

### Invoice Notification
- **Template Name**: `invoice-notification`
- **File**: `invoice-notification.liquid`
- **Variables**:
  - `firstname` (optional): User's first name
  - `invoice_number`: Invoice reference
  - `issue_date`: Invoice issue date
  - `due_date`: Payment due date
  - `total_amount`: Total amount due
  - `items` (optional array): List of invoice items with `description` and `amount`
  - `payment_url`: Link to payment page
  - `account_name`, `bsb`, `account_number`: Bank transfer details

## Usage

### In Directus Flows

When using the "Send Email" operation with type "Template":

1. Set **Template** to the template name without extension (e.g., `welcome-email`)
2. In the **Data** field, provide a JSON object with the required variables:

```json
{
  "firstname": "{{ $trigger.payload.firstname }}",
  "booking_id": "{{ $last.id }}",
  "service_name": "{{ $last.service.name }}",
  "booking_date": "{{ $last.scheduled_at }}",
  "property_address": "{{ $last.property.full_address }}",
  "total_amount": "{{ $last.total_price }}"
}
```

### In Custom Extensions

```javascript
await mailService.send({
    to: 'customer@example.com',
    subject: 'Booking Confirmation',
    template: {
        name: 'booking-confirmation',
        data: {
            firstname: user.firstname,
            booking_id: booking.id,
            service_name: booking.service.name,
            booking_date: booking.scheduled_at,
            property_address: booking.property.full_address,
            total_amount: booking.total_price,
        },
    },
});
```

## Project Variables

These variables are automatically available in all templates:

- `projectName` - Your project name from Directus settings
- `projectColor` - Project color (hex)
- `projectLogo` - Full URL to project logo
- `projectUrl` - Your project's URL

## Styling Components

The base template includes pre-styled components:

### Button
```liquid
<a href="{{ url }}" class="button">Click Here</a>
```

### Link
```liquid
<a href="{{ url }}" class="link">Click Here</a>
```

### Alerts
```liquid
<div class="alert-success">Success message</div>
<div class="alert-warning">Warning message</div>
<div class="alert-error">Error message</div>
<div class="alert-info">Info message</div>
```

## Creating New Templates

1. Create a new `.liquid` file in this directory
2. Start with `{% layout "base" %}`
3. Add your content inside `{% block content %}...{% endblock %}`
4. Restart Directus to make it available
5. Reference by filename without extension

## Example Custom Template

```liquid
{% layout "base" %}

{% block content %}
    <h1>My Custom Email</h1>
    
    <p>Hi{% if firstname %} {{ firstname }}{% endif %},</p>
    
    <p>Your custom content here.</p>
    
    {% if items %}
    <ul>
        {% for item in items %}
        <li>{{ item.name }}</li>
        {% endfor %}
    </ul>
    {% endif %}
    
    <div style="text-align: center;">
        <a href="{{ action_url }}" class="button">Take Action</a>
    </div>
{% endblock %}
```

## Notes

- Templates must be in the root of this directory (no subdirectories)
- Always restart Directus after adding/modifying templates
- Images must be hosted externally or in Directus with public permissions
- Use full URLs for all assets
- Keep a reference list of your templates - Directus doesn't provide autocomplete


