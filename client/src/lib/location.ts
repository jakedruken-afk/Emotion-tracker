import type { LocationSnapshot } from "@shared/contracts";

type GeolocationFailure = {
  code?: number;
  message?: string;
};

export function captureCurrentLocation(): Promise<LocationSnapshot> {
  if (!("geolocation" in navigator)) {
    return Promise.reject(new Error("This device or browser does not support location capture."));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
          locationCapturedAt: new Date(position.timestamp).toISOString(),
        });
      },
      (error) => {
        reject(new Error(getGeolocationErrorMessage(error)));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });
}

function getGeolocationErrorMessage(error: GeolocationFailure) {
  switch (error.code) {
    case 1:
      return "Location permission was denied.";
    case 2:
      return "Your location could not be determined.";
    case 3:
      return "Location capture timed out.";
    default:
      return error.message || "Location capture failed.";
  }
}

export function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function buildMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
