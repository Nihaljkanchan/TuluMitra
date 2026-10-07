export default function TypingBubble({ label = "Tulu Mitra is thinking" }) {
  return (
    <article className="msg msg--bot">
      <span className="bot-av kn-display is-thinking" aria-hidden="true">ತು</span>
      <div className="msg__col">
        <span className="kn-display msg__who">ತುಳು ಮಿತ್ರ</span>
        <div className="msg__bubble msg__bubble--typing">
          <span className="typing" aria-label={label}>
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    </article>
  );
}
