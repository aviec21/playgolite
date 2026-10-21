import sys, struct, numpy as np, onnxruntime as ort, base64, json
sess = ort.InferenceSession(sys.argv[1], providers=["CPUExecutionProvider"])
for line in sys.stdin:
    req = json.loads(line)
    sp = np.frombuffer(base64.b64decode(req["s"]), dtype=np.float32).reshape(1,22,19,19)
    gl = np.frombuffer(base64.b64decode(req["g"]), dtype=np.float32).reshape(1,19)
    out = sess.run(None, {"spatial":sp,"global":gl})
    print(json.dumps({"p": out[0][0].tolist(), "v": out[1][0].tolist(), "o": out[3][0,0].reshape(-1).tolist()}), flush=True)
