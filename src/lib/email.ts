import QRCode from 'qrcode';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

export async function generateQRCode(text: string): Promise<string> {
  return await QRCode.toDataURL(text);
}

export async function sendBookingEmail(to: string, bookingRef: string, eventTitle: string, seatInfo: string, qrDataUrl: string) {
  try {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_placeholder') {
      console.log(`[DEV MODE] Email to ${to}: Booking ${bookingRef} confirmed for ${eventTitle} (Seat: ${seatInfo}).`);
      return;
    }

    await resend.emails.send({
      from: 'tickets@resend.dev',
      to,
      subject: `Ticket Confirmed: ${eventTitle} (${bookingRef})`,
      html: `
        <h2>Your Booking is Confirmed!</h2>
        <p><strong>Event:</strong> ${eventTitle}</p>
        <p><strong>Seat:</strong> ${seatInfo}</p>
        <p><strong>Booking Reference:</strong> ${bookingRef}</p>
        <br/>
        <img src="${qrDataUrl}" alt="QR Ticket" style="width:200px;height:200px;" />
        <p>Show this QR code at the venue entrance.</p>
      `,
    });
  } catch (error) {
    console.error('Email send failure:', error);
  }
}

export async function sendWaitlistOfferEmail(to: string, eventTitle: string, offerLink: string, expiryMinutes: number) {
  try {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_placeholder') {
      console.log(`[DEV MODE] Waitlist Offer for ${to}: Complete within ${expiryMinutes} mins: ${offerLink}`);
      return;
    }

    await resend.emails.send({
      from: 'tickets@resend.dev',
      to,
      subject: `Seat Available! Complete your booking for ${eventTitle}`,
      html: `
        <h2>A seat has opened up!</h2>
        <p>A cancelled seat in your requested category is now reserved for you.</p>
        <p>You have <strong>${expiryMinutes} minutes</strong> to claim it before it goes to the next person.</p>
        <a href="${offerLink}" style="padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:5px;">Claim Your Ticket</a>
      `,
    });
  } catch (error) {
    console.error('Waitlist email failure:', error);
  }
}