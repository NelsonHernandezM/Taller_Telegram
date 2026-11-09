#!/usr/bin/env python3
# ===========================================================================
#  Calculadora en Python (ejemplo del taller)
#  ---------------------------------------------------------------------------
#  El bot la invoca asi desde Node:
#      python calculadora.py sumar 2 3
#      python calculadora.py multiplicar 4 2.5
#
#  Un script .py NO se ejecuta solo: necesita que alguien lo llame
#  (python script.py). Ese "alguien" es Node, que hereda los permisos
#  del usuario que corre el bot. No hay permisos especiales de Node aqui.
# ===========================================================================

import sys


def sumar(a, b):
    return a + b


def multiplicar(a, b):
    return a * b


def main(argv):
    if len(argv) < 4:
        print("uso: calculadora.py <sumar|multiplicar> <a> <b>")
        return 2

    operacion = argv[1].lower()
    try:
        a = float(argv[2])
        b = float(argv[3])
    except ValueError:
        # Codigo de salida distinto de 0 = error (Node lo detecta).
        print("los operandos deben ser numeros")
        return 2

    if operacion == "sumar":
        print("%g + %g = %g" % (a, b, sumar(a, b)))
    elif operacion == "multiplicar":
        print("%g x %g = %g" % (a, b, multiplicar(a, b)))
    else:
        print("operacion no valida: " + operacion)
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
