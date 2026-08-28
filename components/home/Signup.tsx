export function Signup() {
  return (
    <section className="sec">
      <div className="signup rv">
        <div>
          <h2>New looks, straight to WhatsApp</h2>
          <p>
            Two messages a week. The best decodes, the biggest price gaps.
            Unsubscribe with one word.
          </p>
        </div>
        <form className="sform" action="#">
          <input
            placeholder="Your WhatsApp number"
            aria-label="WhatsApp number"
            inputMode="tel"
            name="whatsapp"
          />
          <button className="btn btn-primary" type="submit">
            <span>Get updates</span>
          </button>
        </form>
      </div>
    </section>
  );
}
