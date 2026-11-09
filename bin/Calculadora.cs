// ===========================================================================
//  Calculadora de consola  (ejemplo del taller)
//  ---------------------------------------------------------------------------
//  Este archivo es el CODIGO FUENTE de un .exe de consola.
//  Node no compila C#: aqui solo lo compilamos una vez con csc.exe (ver
//  compilar-exe.bat) para tener un binario real que el bot pueda invocar.
//
//  Uso desde la consola:
//     calculadora.exe sumar 2 3
//     calculadora.exe multiplicar 4 2.5
//     calculadora.exe generar datos\generado\calculadora_generada.py
//
//  Ojo: es C# 5 (csc.exe de .NET Framework), por eso no usamos interpolacion
//  de cadenas ni otras caracteristicas modernas.
// ===========================================================================

using System;
using System.Globalization;
using System.IO;
using System.Text;

class Calculadora
{
    static int Main(string[] args)
    {
        // UTF-8 para que los acentos se vean bien en la consola.
        Console.OutputEncoding = Encoding.UTF8;

        if (args.Length == 0 || args[0] == "ayuda" || args[0] == "--help")
        {
            Ayuda();
            return 0;
        }

        string operacion = args[0].ToLowerInvariant();

        // --- "generar": el .exe escribe un script de Python -----------------
        // Es el ejemplo de que un ejecutable puede crear archivos que luego
        // otro lenguaje (Python) ejecuta.
        if (operacion == "generar")
        {
            string destino = args.Length > 1 ? args[1] : "calculadora_generada.py";
            string carpeta = Path.GetDirectoryName(Path.GetFullPath(destino));
            if (!String.IsNullOrEmpty(carpeta))
                Directory.CreateDirectory(carpeta);

            File.WriteAllText(destino, PlantillaPython(), new UTF8Encoding(false));
            Console.WriteLine("Script generado en: " + Path.GetFullPath(destino));
            return 0;
        }

        // --- "sumar" / "multiplicar" ---------------------------------------
        if (operacion == "sumar" || operacion == "multiplicar")
        {
            if (args.Length < 3)
            {
                Console.Error.WriteLine("Faltan operandos. Ejemplo: calculadora.exe sumar 2 3");
                return 2;
            }

            double a, b;
            // InvariantCulture: el punto decimal no depende del idioma de Windows.
            bool okA = double.TryParse(args[1], NumberStyles.Float, CultureInfo.InvariantCulture, out a);
            bool okB = double.TryParse(args[2], NumberStyles.Float, CultureInfo.InvariantCulture, out b);
            if (!okA || !okB)
            {
                Console.Error.WriteLine("Los operandos deben ser numeros.");
                return 2;
            }

            double resultado = (operacion == "sumar") ? a + b : a * b;
            string signo = (operacion == "sumar") ? " + " : " x ";
            Console.WriteLine(a.ToString(CultureInfo.InvariantCulture) + signo +
                              b.ToString(CultureInfo.InvariantCulture) + " = " +
                              resultado.ToString(CultureInfo.InvariantCulture));
            return 0;
        }

        Console.Error.WriteLine("Operacion no reconocida: " + operacion);
        return 2;
    }

    static void Ayuda()
    {
        Console.WriteLine("Calculadora de consola - taller_compartir");
        Console.WriteLine("");
        Console.WriteLine("  calculadora.exe sumar <a> <b>");
        Console.WriteLine("  calculadora.exe multiplicar <a> <b>");
        Console.WriteLine("  calculadora.exe generar <ruta.py>");
    }

    // Plantilla del script de Python que el .exe escribe en disco.
    // La cadena es verbatim (@) y las comillas se duplican ("").
    static string PlantillaPython()
    {
        return
@"# Script generado automaticamente por calculadora.exe
# Uso: python calculadora_generada.py sumar 2 3
import sys

def sumar(a, b):
    return a + b

def multiplicar(a, b):
    return a * b

def main():
    if len(sys.argv) < 4:
        print(""uso: calculadora_generada.py <sumar|multiplicar> <a> <b>"")
        return 2

    operacion = sys.argv[1].lower()
    try:
        a = float(sys.argv[2])
        b = float(sys.argv[3])
    except ValueError:
        print(""los operandos deben ser numeros"")
        return 2

    if operacion == ""sumar"":
        print(""%g + %g = %g"" % (a, b, sumar(a, b)))
    elif operacion == ""multiplicar"":
        print(""%g x %g = %g"" % (a, b, multiplicar(a, b)))
    else:
        print(""operacion no valida: "" + operacion)
        return 2
    return 0

if __name__ == ""__main__"":
    sys.exit(main())
";
    }
}
