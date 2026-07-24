# Vehicle Accessory Configurator

A 3-step React web application that allows users to select a vehicle, choose accessories, and generate AI-powered preview images showing how the vehicle would look with selected accessories.

![Vehicle Accessory Configurator](public/hero.png)

## Overview

This is a proof-of-concept (POC) application that demonstrates:
- Interactive vehicle and accessory selection
- AI-powered image generation using Google Gemini API
- Real-time preview of configured vehicles with accessories
- Persistent configuration history stored locally
- Support for custom vehicle image uploads via Cloudinary

**Note:** This is a demo application with mock data. No backend database or authentication is included.

---

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS** for styling
- **Google Gemini API** for AI image generation (primary)
- **Cloudinary** for image uploads and hosting
- **IndexedDB** for local storage of configurations and history

---

## Features

### Step 1: Vehicle Selection
- Choose from predefined vehicle makes and models
- Select specific variants (e.g., Rubicon, Sahara, High Altitude)
- Upload custom vehicle images via Cloudinary
- Automatic image quality validation

### Step 2: Accessory Selection
- Browse and select compatible accessories
- Visual cards with images and descriptions
- Real-time compatibility checking
- Support for multiple accessory combinations

### Step 3: AI-Generated Preview
- Generate realistic preview images using Gemini AI
- View generation progress with status updates
- Save configurations to history
- Regenerate with different settings
- Download generated images

### Additional Features
- **Multi-Provider Support**: Switch between Gemini, Vertex AI, or NanoBanana
- **API Key Management**: Configure keys directly in the UI or via environment variables
- **Persistent History**: All configurations saved locally with thumbnails
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Responsive Design**: Works on desktop and mobile devices

---

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Gemini API Key** (get from [Google AI Studio](https://aistudio.google.com/app/apikey))
- **Cloudinary Account** (get from [Cloudinary](https://console.cloudinary.com/))

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://bitbucket.org/ispg-projects/accessory-demo.git
   cd accessory-demo
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```

4. **Edit `.env.local` and add your API keys:**
   ```env
   # REQUIRED: Gemini API key
   VITE_GEMINI_API_KEY=your_gemini_api_key_here

   # REQUIRED: Cloudinary credentials
   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   ```
   http://localhost:5173
   ```

---

## Configuration Guide

### Getting Your API Keys

#### 1. Gemini API Key (Required)

The Gemini API is the primary image generation engine for this application.

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key and add it to `.env.local`:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

**Model Options:**
- `gemini-3-pro-image-preview` - Best quality (slower, more expensive)
- `gemini-3.1-flash-image-preview` - Balanced (default, recommended)
- `gemini-2.5-flash-image` - Fastest (lower quality)

You can set the model in `.env.local` or change it in the app's API Key panel.

#### 2. Cloudinary Setup (Required)

Cloudinary is used for uploading and hosting custom vehicle images.

1. Create account at [Cloudinary](https://console.cloudinary.com/)
2. Go to **Dashboard → Settings → Product environment credentials**
3. Copy your **Cloud Name**
4. Go to **Settings → Upload → Upload presets**
5. Click **"Add upload preset"**
6. Set **Signing Mode** to **"Unsigned"**
7. Save and copy the **Preset Name**
8. Add to `.env.local`:
   ```env
   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=your_preset_name
   ```

**Optional:** For image deletion functionality, add admin credentials:
```env
VITE_CLOUDINARY_API_KEY=your_api_key
VITE_CLOUDINARY_API_SECRET=your_api_secret
```
⚠️ **Warning:** Exposing admin secrets in frontend code is NOT secure. Only use for POC/demo purposes.

#### 3. Alternative Providers (Optional)

**NanoBanana API:**
```env
VITE_NANOBANANA_API_KEY=your_key
```
Get from: [nanobananaapi.ai](https://nanobananaapi.ai)

**Vertex AI (Google Cloud Imagen):**
```env
VITE_VERTEX_PROJECT_ID=your_project_id
VITE_VERTEX_LOCATION=us-central1
VITE_VERTEX_ACCESS_TOKEN=your_token
```
Requires a Google Cloud project with Vertex AI API enabled.

---

## Usage

### Basic Workflow

1. **Select a Vehicle** (Step 1)
   - Choose make, model, and variant from dropdowns
   - OR upload your own vehicle image

2. **Choose Accessories** (Step 2)
   - Select one or more compatible accessories
   - Each accessory shows a preview image

3. **Generate Preview** (Step 3)
   - Click "Generate Image" to create AI preview
   - Wait for generation (typically 10-30 seconds)
   - View, download, or regenerate the result

### Managing API Keys in the App

If you don't want to use `.env.local`, you can configure API keys directly in the app:

1. Click **"API Key"** button in the navigation bar
2. Select your provider (Gemini, NanoBanana, or Vertex AI)
3. Enter your API key
4. Keys are stored in browser's localStorage

### Viewing History

- All configurations are automatically saved
- Click **"History"** to view past generations
- Click any history item to restore that configuration
- Clear history using the "Clear History" button

---

## Project Structure

```
accessory-demo/
├── src/
│   ├── components/
│   │   ├── AccessoryGrid/       # Accessory selection UI
│   │   ├── PreviewCanvas/        # Image generation & preview
│   │   ├── VehicleSelector/      # Vehicle selection UI
│   │   ├── LogBox/               # Activity logging
│   │   └── ui/                   # Shared UI components
│   ├── data/
│   │   ├── vehicles.ts           # Mock vehicle data
│   │   └── accessories.ts        # Mock accessory data
│   ├── services/
│   │   ├── imageService.ts       # AI image generation
│   │   ├── cloudinary.ts         # Image upload/hosting
│   │   └── persistenceService.ts # IndexedDB storage
│   ├── types/
│   │   └── index.ts              # TypeScript definitions
│   ├── utils/
│   │   ├── accessoryCompatibility.ts
│   │   └── apiProvider.ts
│   └── App.tsx                   # Main application
├── public/
│   ├── variants/                 # Vehicle variant images
│   └── accessories/              # Accessory images
├── docs/
│   └── poc-spec.md              # Detailed specification
└── .env.example                  # Environment template
```

---

## Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

---

## Environment Variables Reference

See `.env.example` for the complete list with descriptions. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | ✅ Yes | Google Gemini API key for image generation |
| `VITE_CLOUDINARY_CLOUD_NAME` | ✅ Yes | Cloudinary cloud name for image uploads |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | ✅ Yes | Cloudinary unsigned upload preset |
| `VITE_GEMINI_IMAGE_MODEL` | ❌ No | Override default Gemini model |
| `VITE_NANOBANANA_API_KEY` | ❌ No | Alternative image generation provider |
| `VITE_VERTEX_PROJECT_ID` | ❌ No | Google Cloud project for Vertex AI |

All environment variables are prefixed with `VITE_` to be exposed to the browser.

---

## Troubleshooting

### Image Generation Fails

- **Check API key**: Ensure `VITE_GEMINI_API_KEY` is set correctly
- **Quota limits**: Gemini has rate limits - wait a few minutes
- **Network issues**: Check browser console for error messages

### Upload Not Working

- **Cloudinary config**: Verify cloud name and upload preset
- **Unsigned preset**: Must be set to "Unsigned" in Cloudinary dashboard
- **File size**: Large images (>10MB) may fail

### History Not Saving

- **IndexedDB**: Check if browser supports IndexedDB
- **Storage quota**: Browser may limit storage - clear history to free space

---

## Known Limitations

- **POC Status**: Mock data only, no real backend integration
- **Security**: API keys in `.env.local` are exposed in browser bundle
- **Storage**: History limited to prevent browser storage quota errors
- **Image Quality**: AI generation quality depends on input images and prompts

---

## License

This is a proof-of-concept demo application for internal use.

---

## Support

For questions or issues, please contact the development team or refer to `docs/poc-spec.md` for detailed technical specifications.
