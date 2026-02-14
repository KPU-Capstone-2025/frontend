import "./imacMock.css";
import imac from "../../assets/images/imac.png";

export default function ImacMock({ screenSrc, alt = "dashboard" }) {
  return (
    <div className="imacMock">
      <div className="imacMock__wrap">
        <img className="imacMock__screen" src={screenSrc} alt={alt} />
        <img className="imacMock__imac" src={imac} alt="imac" />
      </div>
    </div>
  );
}
